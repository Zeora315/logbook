import {
  AUTHORS,
  adminPost,
  archivePost,
  deletePost,
  getFeed,
  getPost,
  handleError,
  HttpError,
  json,
  listPosts,
  publicPost,
  readJson,
  requireAdmin,
  savePost
} from "./functions/_lib/changelog.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for frontend
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.FRONTEND_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const context = { request, env };

    try {
      // GET /api/posts
      if (path === "/api/posts" && request.method === "GET") {
        return await handleGetPosts(request, env, corsHeaders);
      }

      // GET /api/feed.json
      if (path === "/api/feed.json" && request.method === "GET") {
        return await handleGetFeed(request, env, corsHeaders);
      }

      // /api/admin/posts
      if (path === "/api/admin/posts") {
        if (request.method === "GET") {
          return await handleAdminList(context, corsHeaders);
        }
        if (request.method === "POST") {
          return await handleAdminCreate(context, corsHeaders);
        }
      }

      // /api/admin/posts/:id
      const postMatch = path.match(/^\/api\/admin\/posts\/([^/]+)$/);
      if (postMatch) {
        const postId = postMatch[1];
        if (request.method === "GET") {
          return await handleAdminGet(context, postId, corsHeaders);
        }
        if (request.method === "PUT") {
          return await handleAdminUpdate(context, postId, corsHeaders);
        }
        if (request.method === "DELETE") {
          return await handleAdminDelete(context, postId, corsHeaders);
        }
      }

      // Not found
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
    publishedOnly: true,
    limit,
    authorId: authorId && authorId !== "all" ? authorId : "",
    tag: tag && tag !== "all" ? tag : ""
  });

  return json(
    {
      posts: posts.map(publicPost),
      authors: AUTHORS
    },
    {
      cacheControl: "public, max-age=45",
      headers: corsHeaders
    }
  );
}

async function handleGetFeed(request, env, corsHeaders) {
  const url = new URL(request.url);
  const feed = await getFeed(env.LOG_KV, {
    origin: url.origin,
    title: env.SITE_TITLE,
    description: env.SITE_DESCRIPTION
  });
  return json(feed, {
    cacheControl: "public, max-age=60",
    headers: corsHeaders
  });
}

async function handleAdminList(context, corsHeaders) {
  await requireAdmin(context);
  const posts = await listPosts(context.env.LOG_KV);
  return json(
    {
      posts: posts.map(adminPost),
      authors: AUTHORS
    },
    { headers: corsHeaders }
  );
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
  const post = await deletePost(context.env.LOG_KV, postId, admin);
  return json({ post: adminPost(post), deleted: true }, { headers: corsHeaders });
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}
