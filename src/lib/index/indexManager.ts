import { warmChunkCache } from "@/lib/retrieval/retrieveContext";

type IndexState = "idle" | "indexing" | "ready" | "error";

interface IndexStatus {
  state: IndexState;
  startedAt?: string;
  completedAt?: string;
  chunkCount?: number;
  error?: string;
}

const statuses = new Map<string, IndexStatus>();

function keyFor(repoPath: string, repoSha: string): string {
  return `${repoPath}:${repoSha}`;
}

export function scheduleIndexBuild(repoPath: string, repoSha: string): IndexStatus {
  const key = keyFor(repoPath, repoSha);
  const current = statuses.get(key);
  if (current?.state === "indexing" || current?.state === "ready") {
    return current;
  }
  const status: IndexStatus = { state: "indexing", startedAt: new Date().toISOString() };
  statuses.set(key, status);
  Promise.resolve()
    .then(() => warmChunkCache(repoPath, repoSha))
    .then((chunkCount) => {
      statuses.set(key, {
        state: "ready",
        startedAt: status.startedAt,
        completedAt: new Date().toISOString(),
        chunkCount
      });
    })
    .catch((error: unknown) => {
      statuses.set(key, {
        state: "error",
        startedAt: status.startedAt,
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown indexing error."
      });
    });
  return status;
}

export function getIndexStatus(repoPath: string, repoSha: string): IndexStatus {
  return statuses.get(keyFor(repoPath, repoSha)) ?? { state: "idle" };
}
