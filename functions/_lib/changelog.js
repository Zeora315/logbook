export const AUTHORS = {
  me: {
    id: "me",
    name: "Zeora",
    color: "#4b8fbf"
  },
  openclaw: {
    id: "openclaw",
    name: "虾米",
    color: "#ee8f43"
  }
};

const INDEX_ADMIN = "index:admin:latest";
const INDEX_PUBLISHED = "index:published:latest";
const STATUS_VALUES = new Set(["draft", "published", "archived"]);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function json(data, init = {}) {
  const status = init.status || 200;
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", init.cacheControl || "no-store");
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

export function handleError(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status });
  }
  return json({ error: "Unexpected server error", detail: error.message }, { status: 500 });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export async function requireAdmin(context) {
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

  throw new HttpError(
    401,
    "Admin API is locked. Configure ADMIN_USERNAME and ADMIN_PASSWORD, or protect /api/admin/* with Cloudflare Access and set TRUST_CF_ACCESS_HEADERS=true."
  );
}

export async function listPosts(kv, options = {}) {
  assertKv(kv);
  const indexKey = options.publishedOnly ? INDEX_PUBLISHED : INDEX_ADMIN;
  const ids = await getIndexIds(kv, indexKey);
  const indexedPosts = await getPostsByIds(kv, ids);
  const storedPosts = await listStoredPosts(kv);
  const posts = mergePosts(storedPosts, indexedPosts);

  if (options.repairIndexes !== false) {
    await repairIndexesIfNeeded(kv, posts);
  }

  const filtered = posts
    .filter((post) => !options.publishedOnly || post.status === "published")
    .filter((post) => !options.authorId || post.authorId === options.authorId)
    .filter((post) => !options.tag || (post.tags || []).includes(options.tag))
    .sort(sortPosts);

  return typeof options.limit === "number" ? filtered.slice(0, options.limit) : filtered;
}

export async function getPost(kv, id) {
  assertKv(kv);
  if (!id) throw new HttpError(400, "Post id is required.");
  const post = await getJson(kv, keyPost(id));
  if (!post) throw new HttpError(404, "Post not found.");
  return post;
}

export async function savePost(kv, input, context = {}) {
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
    id,
    title,
    slug,
    authorId,
    status,
    tags,
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
  writes.push(kv.delete(keyDeleted(id)));
  writes.push(
    putJson(kv, `audit:${Date.now()}:${id}`, {
      id,
      action: existing ? "update" : "create",
      subject: context.subject || "unknown",
      fromStatus: existing?.status || null,
      toStatus: status,
      published: !wasPublished && willPublish,
      at: now
    })
  );

  await Promise.all(writes);
  await rebuildIndexes(kv, id);
  return post;
}

export async function archivePost(kv, id, context = {}) {
  const existing = await getPost(kv, id);
  return savePost(
    kv,
    {
      ...existing,
      status: "archived"
    },
    context
  );
}

export async function deletePost(kv, id, context = {}) {
  assertKv(kv);
  const existing = await getPost(kv, id);
  const now = new Date().toISOString();

  await Promise.all([
    putJson(kv, `post:${id}:rev:${Date.now()}`, existing),
    kv.delete(keyPost(id)),
    existing.slug ? kv.delete(keySlug(existing.slug)) : Promise.resolve(),
    putJson(kv, keyDeleted(id), {
      id,
      slug: existing.slug || "",
      subject: context.subject || "unknown",
      at: now
    }),
    putJson(kv, `audit:${Date.now()}:${id}`, {
      id,
      action: "delete",
      subject: context.subject || "unknown",
      fromStatus: existing.status || null,
      toStatus: "deleted",
      at: now
    })
  ]);

  const remainingPosts = (await listStoredPosts(kv)).filter((post) => post.id !== id).sort(sortPosts);
  await writeIndexes(kv, remainingPosts);
  return existing;
}

export async function getFeed(kv, site = {}) {
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
      authors: [
        {
          name: AUTHORS[post.authorId]?.name || post.authorId
        }
      ],
      tags: post.tags
    }))
  };
}

export function publicPost(post) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    authorId: post.authorId,
    status: post.status,
    tags: post.tags || [],
    summary: post.summary || "",
    body: post.body || "",
    createdAt: post.createdAt,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt
  };
}

export function adminPost(post) {
  return publicPost(post);
}

export async function getJson(kv, key, fallback = null) {
  const text = await kv.get(key);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function getIndexIds(kv, key) {
  const value = await getJson(kv, key, []);
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.id))
    .filter(Boolean);
}

async function getPostsByIds(kv, ids) {
  const uniqueIds = [...new Set(ids)];
  const posts = await Promise.all(uniqueIds.map((id) => getJson(kv, keyPost(id))));
  return posts.filter(Boolean);
}

async function rebuildIndexes(kv, changedId) {
  const storedPosts = await listStoredPosts(kv);
  const changedPost = changedId ? await getJson(kv, keyPost(changedId)) : null;
  const posts = mergePosts(storedPosts, changedPost ? [changedPost] : []).sort(sortPosts);

  await writeIndexes(kv, posts);
}

async function repairIndexesIfNeeded(kv, posts) {
  const sorted = [...posts].sort(sortPosts);
  const [adminIds, publishedIds] = await Promise.all([
    getIndexIds(kv, INDEX_ADMIN),
    getIndexIds(kv, INDEX_PUBLISHED)
  ]);
  const nextAdminIds = sorted.map((post) => post.id);
  const nextPublishedIds = sorted.filter((post) => post.status === "published").map((post) => post.id);

  if (sameIds(adminIds, nextAdminIds) && sameIds(publishedIds, nextPublishedIds)) return;
  await writeIndexes(kv, sorted);
}

async function writeIndexes(kv, posts) {
  const published = posts.filter((post) => post.status === "published");

  await Promise.all([
    putJson(kv, INDEX_ADMIN, posts.map((post) => post.id)),
    putJson(kv, INDEX_PUBLISHED, published.map((post) => post.id)),
    ...Object.keys(AUTHORS).map((authorId) =>
      putJson(
        kv,
        `index:author:${authorId}`,
        published.filter((post) => post.authorId === authorId).map((post) => post.id)
      )
    ),
    ...monthEntries(published).map(([month, monthIds]) => putJson(kv, `index:published:${month}`, monthIds))
  ]);
}

async function listStoredPosts(kv) {
  const posts = [];
  let cursor;

  do {
    const result = await kv.list({ prefix: "post:", cursor });
    const keys = (result.keys || [])
      .map((item) => item.name)
      .filter((name) => /^post:[^:]+$/.test(name));
    const pagePosts = await Promise.all(keys.map((key) => getStoredPost(kv, key)));
    posts.push(...pagePosts.filter(Boolean));
    cursor = result.cursor;
    if (result.list_complete) break;
  } while (cursor);

  return posts;
}

async function getStoredPost(kv, key) {
  const post = await getJson(kv, key);
  if (!post?.id) return null;
  const deleted = await kv.get(keyDeleted(post.id));
  return deleted ? null : post;
}

function mergePosts(...groups) {
  const map = new Map();
  groups.flat().filter(Boolean).forEach((post) => {
    map.set(post.id, post);
  });
  return [...map.values()];
}

function sameIds(left, right) {
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
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
  for (let index = 0; index < 50; index += 1) {
    const candidate = index ? `${base}-${index + 1}` : base;
    const existingId = await kv.get(keySlug(candidate));
    if (!existingId || existingId === currentId) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function ensureUniqueId(kv, base) {
  const safeBase = base.slice(0, 96).replace(/-+$/g, "");
  for (let index = 0; index < 20; index += 1) {
    const candidate = index ? `${safeBase}-${index + 1}` : safeBase;
    const existing = await kv.get(keyPost(candidate));
    if (!existing) return candidate;
  }
  return `${safeBase}-${crypto.randomUUID().slice(0, 8)}`;
}

function putJson(kv, key, value) {
  return kv.put(key, JSON.stringify(value));
}

function keyPost(id) {
  return `post:${id}`;
}

function keySlug(slug) {
  return `slug:${slug}`;
}

function keyDeleted(id) {
  return `deleted:${id}`;
}

function sortPosts(a, b) {
  const left = Date.parse(a.publishedAt || a.updatedAt || a.createdAt || 0);
  const right = Date.parse(b.publishedAt || b.updatedAt || b.createdAt || 0);
  return right - left;
}

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "post";
}

function compactDate(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeTags(value) {
  const tags = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(tags.map((tag) => cleanText(tag).toLowerCase()).filter(Boolean))].slice(0, 16);
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseBasicAuth(header) {
  const match = String(header || "").match(/^Basic\s+(.+)$/i);
  if (!match) return null;

  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

function isLocalhost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function assertKv(kv) {
  if (!kv) {
    throw new HttpError(500, "LOG_KV binding is missing.");
  }
}
