import { database } from "@/lib/db/client";
import { apiOk, newRequestId } from "@/lib/api/response";

export async function GET() {
  const requestId = newRequestId();
  const conversations = database.listConversations();
  return apiOk(requestId, { conversations });
}
