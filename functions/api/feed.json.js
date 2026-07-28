import { getFeed, handleError, json } from "../_lib/changelog.js";

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const feed = await getFeed(context.env.LOG_KV, {
      origin: url.origin,
      title: context.env.SITE_TITLE,
      description: context.env.SITE_DESCRIPTION
    });
    return json(feed, {
      cacheControl: "public, max-age=60"
    });
  } catch (error) {
    return handleError(error);
  }
}
