import { getRss, rssResponse } from "./changelog.js";

/**
 * Shared handler for the RSS 2.0 feeds (/rss.xml and /feed.xml).
 * Supports ?author=<id> and ?tag=<name> filters.
 * @param {object} context Pages Functions event context.
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const authorId = url.searchParams.get("author") || "";
    const tag = url.searchParams.get("tag") || "";
    const feedUrl = `${url.origin}/rss.xml${url.search}`;
    const xml = await getRss(context.env.LOG_KV, {
      origin: url.origin,
      title: context.env.SITE_TITLE,
      description: context.env.SITE_DESCRIPTION,
      authorId,
      tag,
      feedUrl
    });
    return rssResponse(xml, { cacheControl: "public, max-age=60" });
  } catch (error) {
    return new Response("RSS feed error: " + (error && error.message ? error.message : error), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
}
