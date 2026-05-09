import { NextRequest } from "next/server";
import { z } from "zod";
import { cloneOrRefreshRepo } from "@/lib/repo/cloneRepo";
import { database } from "@/lib/db/client";
import { apiError, apiOk, newRequestId } from "@/lib/api/response";
import { logEvent } from "@/lib/telemetry/logger";
import { scheduleIndexBuild, getIndexStatus } from "@/lib/index/indexManager";

const requestSchema = z.object({
  repoUrl: z.string().url(),
  title: z.string().optional()
});

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  try {
    const body = requestSchema.parse(await req.json());
    const cloned = cloneOrRefreshRepo(body.repoUrl);
    const snapshotId = database.createRepoSnapshot({
      repoUrl: body.repoUrl,
      localPath: cloned.localPath,
      commitSha: cloned.commitSha
    });
    const conversationId = database.createConversation({
      repoSnapshotId: snapshotId,
      title: body.title ?? body.repoUrl
    });
    scheduleIndexBuild(cloned.localPath, cloned.commitSha);
    logEvent("info", "repo_ingested", {
      requestId,
      conversationId,
      repoUrl: body.repoUrl
    });
    return apiOk(requestId, {
      conversationId,
      snapshotId,
      commitSha: cloned.commitSha,
      indexing: getIndexStatus(cloned.localPath, cloned.commitSha)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest repository.";
    logEvent("error", "repo_ingest_failed", { requestId, message });
    return apiError(requestId, "INGEST_FAILED", message, 400);
  }
}
