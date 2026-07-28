import {
  adminPost,
  archivePost,
  getPost,
  handleError,
  json,
  readJson,
  requireAdmin,
  savePost
} from "../../../_lib/changelog.js";

export async function onRequestGet(context) {
  try {
    await requireAdmin(context);
    const post = await getPost(context.env.LOG_KV, context.params.id);
    return json({ post: adminPost(post) });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPut(context) {
  try {
    const admin = await requireAdmin(context);
    const input = await readJson(context.request);
    const post = await savePost(
      context.env.LOG_KV,
      {
        ...input,
        id: context.params.id
      },
      admin
    );
    return json({ post: adminPost(post) });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestDelete(context) {
  try {
    const admin = await requireAdmin(context);
    const post = await archivePost(context.env.LOG_KV, context.params.id, admin);
    return json({ post: adminPost(post) });
  } catch (error) {
    return handleError(error);
  }
}
