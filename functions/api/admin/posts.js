import {
  AUTHORS,
  adminPost,
  handleError,
  json,
  listPosts,
  readJson,
  requireAdmin,
  savePost
} from "../../_lib/changelog.js";

export async function onRequestGet(context) {
  try {
    await requireAdmin(context);
    const posts = await listPosts(context.env.LOG_KV, { repair: true });
    return json({
      posts: posts.map(adminPost),
      authors: AUTHORS
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPost(context) {
  try {
    const admin = await requireAdmin(context);
    const input = await readJson(context.request);
    const post = await savePost(context.env.LOG_KV, input, admin);
    return json({ post: adminPost(post) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
