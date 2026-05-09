import { database } from "@/lib/db/client";
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
  const history = database.getConversationHistory(conversationId);
  return apiOk(requestId, { conversationId, history });
}
