import { handleError, serveFile } from "../../_lib/changelog.js";

export async function onRequestGet(context) {
  try {
    return await serveFile(context.env.LOG_KV, context.params.id);
  } catch (error) {
    return handleError(error);
  }
}
