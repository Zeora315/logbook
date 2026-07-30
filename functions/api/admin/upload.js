import { handleError, json, requireAdmin, uploadFile } from "../../_lib/changelog.js";

export async function onRequestPost(context) {
  try {
    const admin = await requireAdmin(context);
    const result = await uploadFile(context.env.LOG_KV, context.request, admin);
    return json({ attachment: result }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
