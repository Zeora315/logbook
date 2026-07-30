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
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB，KV 单值上限 25MB，留余量

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
  // KV list 和索引都可能短暂滞后；合并两边，避免连续发布时旧内容被“挤掉”。
  const [storedPosts, indexIds] = await Promise.all([
    listStoredPosts(kv),
    getIndexIds(kv, options.publishedOnly ? INDEX_PUBLISHED : INDEX_ADMIN)
  ]);
  const indexedPosts = await getPostsByIds(kv, indexIds);
  const posts = mergePosts(indexedPosts, storedPosts);

  if (options.repair === true) {
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
  const post = await getStoredPost(kv, keyPost(id));
  if (!post) throw new HttpError(404, "Post not found.");
  return post;
}

export async function savePost(kv, input, context = {}) {
  assertKv(kv);
  const now = new Date().toISOString();
  const requestedId = cleanText(input.id);
  const existing = requestedId ? await getStoredPost(kv, keyPost(requestedId)) : null;
  const title = cleanText(input.title);
  const body = cleanText(input.body);

  if (!title) throw new HttpError(400, "Title is required.");
  if (!body) throw new HttpError(400, "Body is required.");
  if (requestedId && !existing) {
    throw new HttpError(404, "Post not found for update. Create a new post without an id.");
  }

  const status = STATUS_VALUES.has(input.status) ? input.status : "draft";
  const authorId = AUTHORS[input.authorId] ? input.authorId : "me";
  const baseSlug = slugify(input.slug || title);
  const slug = await ensureUniqueSlug(kv, baseSlug, existing?.id);
  const id = existing?.id || (await ensureUniqueId(kv, `${compactDate(now)}-${slug}`));
  const tags = normalizeTags(input.tags);
  const links = normalizeLinks(input.links);
  const attachments = normalizeAttachments(input.attachments);
  const wasPublished = existing?.status === "published";
  const willPublish = status === "published";

  // 自定义发布日期：导入旧说说或指定某一天
  const inputDate = cleanText(input.publishedAt);
  let publishedAt = existing?.publishedAt || "";
  if (inputDate && !Number.isNaN(Date.parse(inputDate))) {
    publishedAt = new Date(inputDate).toISOString();
  } else if (willPublish && !publishedAt) {
    publishedAt = now;
  }
  // 取消发布（草稿/归档）时保留原发布时间，便于重新发布

  const post = {
    id,
    title,
    slug,
    authorId,
    status,
    tags,
    summary: cleanText(input.summary),
    body,
    links,
    attachments,
    createdAt: existing?.createdAt || now,
    publishedAt,
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
  const companionPosts = await findDeleteCompanions(kv, existing);
  const targets = [existing, ...companionPosts];
  const targetIds = new Set(targets.map((post) => post.id));

  // 1. Archive the old version, delete post data, mark as deleted
  await Promise.all(
    targets.flatMap((post) => [
      putJson(kv, `post:${post.id}:rev:${Date.now()}`, post),
      kv.delete(keyPost(post.id)),
      post.slug ? kv.delete(keySlug(post.slug)) : Promise.resolve(),
      putJson(kv, keyDeleted(post.id), {
        id: post.id,
        slug: post.slug || "",
        subject: context.subject || "unknown",
        at: now
      }),
      putJson(kv, `audit:${Date.now()}:${post.id}`, {
        id: post.id,
        action: "delete",
        subject: context.subject || "unknown",
        fromStatus: post.status || null,
        toStatus: "deleted",
        at: now
      })
    ])
  );

  // 2. Rebuild indexes from scan + existing index, explicitly excluding deleted id.
  const [storedPosts, adminIds, publishedIds] = await Promise.all([
    listStoredPosts(kv),
    getIndexIds(kv, INDEX_ADMIN),
    getIndexIds(kv, INDEX_PUBLISHED)
  ]);
  const indexedPosts = await getPostsByIds(kv, [...adminIds, ...publishedIds]);
  const remainingPosts = mergePosts(indexedPosts, storedPosts)
    .filter((post) => !targetIds.has(post.id))
    .sort(sortPosts);
  await writeIndexes(kv, remainingPosts);
  return { ...existing, deletedIds: [...targetIds] };
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

/**
 * Escape a string for safe inclusion in XML text/attribute nodes.
 * @param {any} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Apply inline markdown formatting (bold + inline code) to an already XML-escaped string.
 * @param {string} value
 * @returns {string}
 */
function inlineRssFormat(value) {
  return escapeXml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

/**
 * Render post body (lightweight markdown) to HTML for RSS content:encoded.
 * @param {string} source
 * @returns {string}
 */
function renderRssBody(source) {
  const lines = String(source || "").split(/\r?\n/);
  const html = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inlineRssFormat(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inlineRssFormat(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h2>${inlineRssFormat(line.slice(2))}</h2>`);
    } else if (line.startsWith("- ")) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inlineRssFormat(line.slice(2))}</li>`);
    } else {
      closeList();
      html.push(`<p>${inlineRssFormat(line)}</p>`);
    }
  }
  closeList();
  return html.join("");
}

/**
 * Render a single RSS <item> element.
 * @param {object} post
 * @param {string} origin
 * @returns {string}
 */
function renderRssItem(post, origin) {
  const author = AUTHORS[post.authorId] || AUTHORS.me;
  const link = origin ? `${origin}/#${post.slug || post.id}` : `#${post.slug || post.id}`;
  const guid = post.id || `${post.slug || ""}-${post.publishedAt || post.updatedAt}`;
  const dateValue = post.publishedAt || post.updatedAt || post.createdAt;
  const pubDate = dateValue ? new Date(dateValue).toUTCString() : new Date().toUTCString();
  const summary = post.summary || String(post.body || "").slice(0, 160);
  let content = renderRssBody(post.body || "");

  // 附件图片加入正文
  const images = (post.attachments || []).filter((a) => a.kind === "image");
  if (images.length) {
    content += images.map((a) => `<p><img src="${escapeXml(absoluteUrl(origin, a.url))}" alt="${escapeXml(a.alt || a.name || "")}" /></p>`).join("");
  }
  // 底部链接
  const links = post.links || [];
  if (links.length) {
    content += `<p>` + links.map((l) => `🔗 <a href="${escapeXml(l.url)}">${escapeXml(l.label || l.url)}</a>`).join(" · ") + `</p>`;
  }

  const categoryLines = (post.tags || [])
    .map((tag) => `      <category>${escapeXml(tag)}</category>`)
    .join("\n");

  return `    <item>
      <title>${escapeXml(post.title || "更新")}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(author.name)}</dc:creator>
${categoryLines ? categoryLines + "\n" : ""}      <description>${escapeXml(summary)}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
    </item>
`;
}

/**
 * Build an RSS 2.0 XML feed for all published posts (optionally filtered by author/tag).
 * @param {KVNamespace} kv
 * @param {object} [site]
 * @returns {Promise<string>}
 */
export async function getRss(kv, site = {}) {
  const authorId = site.authorId && AUTHORS[site.authorId] ? site.authorId : "";
  const tag = site.tag || "";
  const origin = (site.origin || "").replace(/\/$/, "");
  const baseTitle = site.title || "我的更新日志";
  const description =
    site.description ||
    "Zeora 和虾米的更新日志，记录每个项目的更新、发布、修复与小里程碑。";
  const feedUrl = site.feedUrl || `${origin}/rss.xml`;

  const filterLabel = authorId ? AUTHORS[authorId].name : tag ? `#${tag}` : "";
  const channelTitle = filterLabel ? `${baseTitle} · ${filterLabel}` : baseTitle;

  const posts = await listPosts(kv, {
    publishedOnly: true,
    limit: site.limit || 50,
    authorId,
    tag
  });

  let itemsXml;
  if (posts.length) {
    itemsXml = posts.map((post) => renderRssItem(post, origin)).join("");
  } else {
    const emptyPub = new Date().toUTCString();
    itemsXml =
      `    <item>\n` +
      `      <title>还没有已发布的更新</title>\n` +
      `      <link>${escapeXml(origin || "/")}</link>\n` +
      `      <guid isPermaLink="false">${escapeXml(origin || "/")}-empty</guid>\n` +
      `      <pubDate>${emptyPub}</pubDate>\n` +
      `      <description>这个更新日志还没有内容。</description>\n` +
      `    </item>\n`;
  }

  const lastBuild = posts.length
    ? new Date(posts[0].publishedAt || posts[0].updatedAt).toUTCString()
    : new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(origin || feedUrl)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <generator>Zeora Logbook</generator>
${itemsXml}  </channel>
</rss>`;
}

/**
 * Wrap RSS XML in a Response with the correct content type.
 * @param {string} xml
 * @param {object} [init]
 * @returns {Response}
 */
export function rssResponse(xml, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/rss+xml; charset=utf-8");
  headers.set("cache-control", init.cacheControl || "public, max-age=60");
  return new Response(xml, { status: init.status || 200, headers });
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
    links: post.links || [],
    attachments: post.attachments || [],
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
  const posts = await Promise.all(uniqueIds.map((id) => getStoredPost(kv, keyPost(id))));
  return posts.filter(Boolean);
}

async function rebuildIndexes(kv, changedId) {
  const [storedPosts, adminIds, publishedIds] = await Promise.all([
    listStoredPosts(kv),
    getIndexIds(kv, INDEX_ADMIN),
    getIndexIds(kv, INDEX_PUBLISHED)
  ]);
  const [indexedPosts, changedPost] = await Promise.all([
    getPostsByIds(kv, [...adminIds, ...publishedIds]),
    changedId ? getJson(kv, keyPost(changedId)) : null
  ]);
  const posts = mergePosts(indexedPosts, storedPosts, changedPost ? [changedPost] : []).sort(sortPosts);
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

async function findDeleteCompanions(kv, source) {
  const posts = await listStoredPosts(kv);
  return posts.filter((post) => post.id !== source.id && isSameLogicalPost(post, source));
}

function isSameLogicalPost(left, right) {
  return (
    left.authorId === right.authorId &&
    cleanText(left.title).toLowerCase() === cleanText(right.title).toLowerCase() &&
    cleanText(left.body) === cleanText(right.body) &&
    dateKey(left.publishedAt) === dateKey(right.publishedAt) &&
    Boolean(dateKey(left.publishedAt))
  );
}

function dateKey(value) {
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? cleanText(value) : new Date(time).toISOString();
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

function keyFileMeta(id) {
  return `file:meta:${id}`;
}

function keyFileData(id) {
  return `file:data:${id}`;
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

function normalizeLinks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const label = cleanText(item.label).slice(0, 80);
    const url = cleanText(item.url);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ label: label || url, url: url.slice(0, 500) });
  }
  return out.slice(0, 32);
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const url = cleanText(item.url);
    if (!url || !isAllowedAttachmentUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const kind = item.kind === "image" || /^image\//i.test(item.type || "") ? "image" : "file";
    out.push({
      kind,
      url: url.slice(0, 500),
      name: cleanText(item.name).slice(0, 120),
      alt: cleanText(item.alt || "").slice(0, 120),
      type: cleanText(item.type || ""),
      size: Number.isFinite(item.size) ? Number(item.size) : 0
    });
  }
  return out.slice(0, 32);
}

function isAllowedAttachmentUrl(url) {
  return /^https?:\/\//i.test(url) || url.startsWith("/api/files/");
}

function absoluteUrl(origin, url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return (origin || "") + url;
  return url;
}

export async function uploadFile(kv, request, context) {
  assertKv(kv);
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    throw new HttpError(400, "Request must be multipart/form-data.");
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "undefined") {
    throw new HttpError(400, "No file field in upload.");
  }
  if (typeof file === "string") {
    throw new HttpError(400, "Uploaded field is not a file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `File too large. Max ${MAX_UPLOAD_BYTES} bytes.`);
  }

  const rawName = cleanText(file.name || "attachment");
  const type = cleanText(file.type || "application/octet-stream");
  const size = arrayBuffer.byteLength;
  const id = `upl-${compactDate(new Date().toISOString())}-${crypto.randomUUID().slice(0, 8)}`;
  const kind = type.startsWith("image/") ? "image" : "file";

  const meta = {
    id,
    name: rawName.slice(0, 180),
    type,
    size,
    kind,
    uploadedAt: new Date().toISOString(),
    subject: context.subject || "unknown"
  };

  await Promise.all([
    putJson(kv, keyFileMeta(id), meta),
    kv.put(keyFileData(id), arrayBuffer)
  ]);

  return {
    id,
    url: `/api/files/${id}`,
    name: meta.name,
    type,
    size,
    kind
  };
}

export async function serveFile(kv, id) {
  assertKv(kv);
  if (!id) throw new HttpError(400, "File id is required.");
  const meta = await getJson(kv, keyFileMeta(id));
  if (!meta) throw new HttpError(404, "File not found.");
  const data = await kv.get(keyFileData(id), "arrayBuffer");
  if (!data) throw new HttpError(404, "File data is missing.");

  const headers = new Headers();
  headers.set("content-type", meta.type || "application/octet-stream");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  const safeName = (meta.name || "file").replace(/"/g, "_");
  headers.set("content-disposition", `inline; filename="${safeName}"`);
  headers.set("access-control-allow-origin", "*");
  return new Response(data, { status: 200, headers });
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
