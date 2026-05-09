import { database } from "@/lib/db/client";
import { getIndexStatus } from "@/lib/index/indexManager";
import { apiError, apiOk, newRequestId } from "@/lib/api/response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> }
) {
  const requestId = newRequestId();
  const params = await context.params;
  const conversationId = Number(params.conversationId);
  if (!Number.isFinite(conversationId)) {
    return apiError(requestId, "INVALID_REQUEST", "Invalid conversation ID.", 400);
  }
  const conversation = database.getConversation(conversationId);
  if (!conversation) {
    return apiError(requestId, "NOT_FOUND", "Conversation not found.", 404);
  }
  const snapshot = database.getRepoSnapshot(conversation.repo_snapshot_id);
  if (!snapshot) {
    return apiError(requestId, "NOT_FOUND", "Repository snapshot not found.", 404);
  }
  return apiOk(requestId, {
    conversationId,
    status: getIndexStatus(snapshot.local_path, snapshot.commit_sha)
  });
}
