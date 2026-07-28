import { AUTHORS, handleError, json, listPosts, publicPost } from "../_lib/changelog.js";

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 50);
    const authorId = url.searchParams.get("author") || "";
    const tag = url.searchParams.get("tag") || "";
    const posts = await listPosts(context.env.LOG_KV, {
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
        cacheControl: "public, max-age=45"
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}
