// === 复制下面所有内容到 Cloudflare Worker 编辑器 ===

const AUTHORS = {
  me: { id: "me", name: "Zeora", color: "#4b8fbf" },
  openclaw: { id: "openclaw", name: "虾米", color: "#ee8f43" }
};

const INDEX_ADMIN = "index:admin:latest";
const INDEX_PUBLISHED = "index:published:latest";
const STATUS_VALUES = new Set(["draft", "published", "archived"]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function json(data, init = {}) {
  const status = init.status || 200;
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", init.cacheControl || "no-store");
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

function handleError(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status });
  }
  return json({ error: "Unexpected server error", detail: error.message }, { status: 500 });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

async function requireAdmin(context) {
  const request = context.request;
  const url = new URL(request.url);
  const username = context.env.ADMIN_USERNAME;
  const password = context.env.ADMIN_PASSWORD;
  const token = context.env.ADMIN_API_TOKEN;
  const authorization = request.headers.get("authorization") || "";

  if (username && password) {
    const credentials = parseBasicAuth(authorization);
    if (credentials && safeEqual(credentials.username, username) && safeEqual(credentials.password, password)) {
      return { subject: username };
    }
  }

  if (token) {
    const supplied = authorization.replace(/^Bearer\s+/i, "").trim();
    if (safeEqual(supplied, token)) {
      return { subject: "token" };
    }
  }

  if (username && password) {
    throw new HttpError(401, "Missing or invalid admin username/password.");
  }

  if (token) throw new HttpError(401, "Missing or invalid admin API token.");

  const accessEmail = request.headers.get("cf-access-authenticated-user-email");
  if (context.env.TRUST_CF_ACCESS_HEADERS === "true" && accessEmail) {
    const allowed = parseList(context.env.ADMIN_EMAILS);
    if (!allowed.length || allowed.includes(accessEmail.toLowerCase())) {
      return { subject: accessEmail };
    }
    throw new HttpError(403, "This Cloudflare Access user is not allowed to edit posts.");
  }

  if (isLocalhost(url.hostname)) {
    return { subject: "local-dev" };
  }

  throw new HttpError(401, "Admin API is locked. Configure ADMIN_USERNAME and ADMIN_PASSWORD.");
}

async function listPosts(kv, options = {}) {
  assertKv(kv);
  const ids = await getIndexIds(kv, options.publishedOnly ? INDEX_PUBLISHED : INDEX_ADMIN);
  const posts = await getPostsByIds(kv, ids);
  const filtered = posts
    .filter((post) => !options.publishedOnly || post.status === "published")
    .filter((post) => !options.authorId || post.authorId === options.authorId)
    .filter((post) => !options.tag || (post.tags || []).includes(options.tag))
    .sort(sortPosts);
  return typeof options.limit === "number" ? filtered.slice(0, options.limit) : filtered;
}

async function getPost(kv, id) {
  assertKv(kv);
  if (!id) throw new HttpError(400, "Post id is required.");
  const post = await getJson(kv, keyPost(id));
  if (!post) throw new HttpError(404, "Post not found.");
  return post;
}

async function savePost(kv, input, context = {}) {
  assertKv(kv);
  const now = new Date().toISOString();
  const existing = input.id ? await getJson(kv, keyPost(input.id)) : null;
  const title = cleanText(input.title);
  const body = cleanText(input.body);

  if (!title) throw new HttpError(400, "Title is required.");
  if (!body) throw new HttpError(400, "Body is required.");

  const status = STATUS_VALUES.has(input.status) ? input.status : "draft";
  const authorId = AUTHORS[input.authorId] ? input.authorId : "me";
  const baseSlug = slugify(input.slug || title);
  const slug = await ensureUniqueSlug(kv, baseSlug, existing?.id);
  const id = existing?.id || (await ensureUniqueId(kv, `${compactDate(now)}-${slug}`));
  const tags = normalizeTags(input.tags);
  const wasPublished = existing?.status === "published";
  const willPublish = status === "published";

  const post = {
    id, title, slug, authorId, status, tags,
    summary: cleanText(input.summary),
    body,
    createdAt: existing?.createdAt || now,
    publishedAt: willPublish ? existing?.publishedAt || now : existing?.publishedAt || "",
    updatedAt: now
  };

  const writes = [];
  if (existing) {
    writes.push(putJson(kv, `post:${id}:rev:${Date.now()}`, existing));
    if (existing.slug && existing.slug !== post.slug) {
      writes.push(kv.delete(keySlug(existing.slug)));
    }
  }

  writes.push(putJson(kv, keyPost(id), post));
  writes.push(kv.put(keySlug(slug), id));
  writes.push(putJson(kv, `audit:${Date.now()}:${id}`, {
    id, action: existing ? "update" : "create",
    subject: context.subject || "unknown",
    fromStatus: existing?.status || null, toStatus: status,
    published: !wasPublished && willPublish, at: now
  }));

  await Promise.all(writes);
  await rebuildIndexes(kv, id);
  return post;
}

async function archivePost(kv, id, context = {}) {
  const existing = await getPost(kv, id);
  return savePost(kv, { ...existing, status: "archived" }, context);
}

async function getFeed(kv, site = {}) {
  const posts = await listPosts(kv, { publishedOnly: true, limit: site.limit || 50 });
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: site.title || "我的更新日志",
    description: site.description || "Zeora 和虾米的更新日志。",
    home_page_url: site.origin || "",
    feed_url: site.origin ? `${site.origin}/api/feed.json` : "",
    items: posts.map((post) => ({
      id: post.id,
      url: site.origin ? `${site.origin}/#${post.slug}` : post.slug,
      title: post.title,
      summary: post.summary,
      content_text: post.body,
      date_published: post.publishedAt || post.updatedAt,
      date_modified: post.updatedAt,
      authors: [{ name: AUTHORS[post.authorId]?.name || post.authorId }],
      tags: post.tags
    }))
  };
}

function publicPost(post) {
  return {
    id: post.id, title: post.title, slug: post.slug, authorId: post.authorId,
    status: post.status, tags: post.tags || [], summary: post.summary || "",
    body: post.body || "", createdAt: post.createdAt,
    publishedAt: post.publishedAt, updatedAt: post.updatedAt
  };
}

function adminPost(post) { return publicPost(post); }

async function getJson(kv, key, fallback = null) {
  const text = await kv.get(key);
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

async function getIndexIds(kv, key) {
  const value = await getJson(kv, key, []);
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : item?.id)).filter(Boolean);
}

async function getPostsByIds(kv, ids) {
  const uniqueIds = [...new Set(ids)];
  const posts = await Promise.all(uniqueIds.map((id) => getJson(kv, keyPost(id))));
  return posts.filter(Boolean);
}

async function rebuildIndexes(kv, changedId) {
  const currentIds = await getIndexIds(kv, INDEX_ADMIN);
  const ids = [...new Set([...currentIds, changedId])].filter(Boolean);
  const posts = (await getPostsByIds(kv, ids)).sort(sortPosts);
  const published = posts.filter((post) => post.status === "published");

  await Promise.all([
    putJson(kv, INDEX_ADMIN, posts.map((post) => post.id)),
    putJson(kv, INDEX_PUBLISHED, published.map((post) => post.id)),
    ...Object.keys(AUTHORS).map((authorId) =>
      putJson(kv, `index:author:${authorId}`, published.filter((post) => post.authorId === authorId).map((post) => post.id))
    ),
    ...monthEntries(published).map(([month, monthIds]) => putJson(kv, `index:published:${month}`, monthIds))
  ]);
}

function monthEntries(posts) {
  const months = new Map();
  for (const post of posts) {
    const month = (post.publishedAt || post.updatedAt || "").slice(0, 7);
    if (!month) continue;
    const ids = months.get(month) || [];
    ids.push(post.id);
    months.set(month, ids);
  }
  return [...months.entries()];
}

async function ensureUniqueSlug(kv, slug, currentId) {
  const base = slug || `post-${compactDate(new Date().toISOString())}`;
  for (let i = 0; i < 50; i++) {
    const candidate = i ? `${base}-${i + 1}` : base;
    const existingId = await kv.get(keySlug(candidate));
    if (!existingId || existingId === currentId) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function ensureUniqueId(kv, base) {
  const safeBase = base.slice(0, 96).replace(/-+$/g, "");
  for (let i = 0; i < 20; i++) {
    const candidate = i ? `${safeBase}-${i + 1}` : safeBase;
    const existing = await kv.get(keyPost(candidate));
    if (!existing) return candidate;
  }
  return `${safeBase}-${crypto.randomUUID().slice(0, 8)}`;
}

function putJson(kv, key, value) { return kv.put(key, JSON.stringify(value)); }
function keyPost(id) { return `post:${id}`; }
function keySlug(slug) { return `slug:${slug}`; }

function sortPosts(a, b) {
  const left = Date.parse(a.publishedAt || a.updatedAt || a.createdAt || 0);
  const right = Date.parse(b.publishedAt || b.updatedAt || b.createdAt || 0);
  return right - left;
}

function slugify(value) {
  const slug = String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "post";
}

function compactDate(value) { return value.slice(0, 10).replaceAll("-", ""); }
function cleanText(value) { return String(value ?? "").trim(); }

function normalizeTags(value) {
  const tags = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(tags.map((tag) => cleanText(tag).toLowerCase()).filter(Boolean))].slice(0, 16);
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

function parseList(value) {
  return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function parseBasicAuth(header) {
  const match = String(header || "").match(/^Basic\s+(.+)$/i);
  if (!match) return null;
  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return { username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
  } catch { return null; }
}

function isLocalhost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function assertKv(kv) {
  if (!kv) throw new HttpError(500, "LOG_KV binding is missing.");
}

// === Worker 入口 ===
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": env.FRONTEND_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const context = { request, env };

    try {
      if (path === "/api/posts" && request.method === "GET") {
        return await handleGetPosts(request, env, corsHeaders);
      }

      if (path === "/api/feed.json" && request.method === "GET") {
        return await handleGetFeed(request, env, corsHeaders);
      }

      if (path === "/api/admin/posts") {
        if (request.method === "GET") return await handleAdminList(context, corsHeaders);
        if (request.method === "POST") return await handleAdminCreate(context, corsHeaders);
      }

      const postMatch = path.match(/^\/api\/admin\/posts\/([^/]+)$/);
      if (postMatch) {
        const postId = postMatch[1];
        if (request.method === "GET") return await handleAdminGet(context, postId, corsHeaders);
        if (request.method === "PUT") return await handleAdminUpdate(context, postId, corsHeaders);
        if (request.method === "DELETE") return await handleAdminDelete(context, postId, corsHeaders);
      }

      return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    } catch (error) {
      const response = handleError(error);
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...corsHeaders }
      });
    }
  }
};

async function handleGetPosts(request, env, corsHeaders) {
  const url = new URL(request.url);
  const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 50);
  const authorId = url.searchParams.get("author") || "";
  const tag = url.searchParams.get("tag") || "";
  const posts = await listPosts(env.LOG_KV, {
    publishedOnly: true, limit,
    authorId: authorId && authorId !== "all" ? authorId : "",
    tag: tag && tag !== "all" ? tag : ""
  });
  return json({ posts: posts.map(publicPost), authors: AUTHORS }, { cacheControl: "public, max-age=45", headers: corsHeaders });
}

async function handleGetFeed(request, env, corsHeaders) {
  const url = new URL(request.url);
  const feed = await getFeed(env.LOG_KV, { origin: url.origin, title: env.SITE_TITLE, description: env.SITE_DESCRIPTION });
  return json(feed, { cacheControl: "public, max-age=60", headers: corsHeaders });
}

async function handleAdminList(context, corsHeaders) {
  await requireAdmin(context);
  const posts = await listPosts(context.env.LOG_KV);
  return json({ posts: posts.map(adminPost), authors: AUTHORS }, { headers: corsHeaders });
}

async function handleAdminCreate(context, corsHeaders) {
  const admin = await requireAdmin(context);
  const input = await readJson(context.request);
  const post = await savePost(context.env.LOG_KV, input, admin);
  return json({ post: adminPost(post) }, { status: 201, headers: corsHeaders });
}

async function handleAdminGet(context, postId, corsHeaders) {
  await requireAdmin(context);
  const post = await getPost(context.env.LOG_KV, postId);
  return json({ post: adminPost(post) }, { headers: corsHeaders });
}

async function handleAdminUpdate(context, postId, corsHeaders) {
  const admin = await requireAdmin(context);
  const input = await readJson(context.request);
  const post = await savePost(context.env.LOG_KV, { ...input, id: postId }, admin);
  return json({ post: adminPost(post) }, { headers: corsHeaders });
}

async function handleAdminDelete(context, postId, corsHeaders) {
  const admin = await requireAdmin(context);
  const post = await archivePost(context.env.LOG_KV, postId, admin);
  return json({ post: adminPost(post) }, { headers: corsHeaders });
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}