import { apiOk, newRequestId } from "@/lib/api/response";
import { snapshotMetrics } from "@/lib/telemetry/metrics";
import { getRetrievalCacheStats } from "@/lib/retrieval/retrieveContext";

export async function GET() {
  const requestId = newRequestId();
  return apiOk(requestId, {
    metrics: snapshotMetrics(),
    retrievalCache: getRetrievalCacheStats()
  });
}
