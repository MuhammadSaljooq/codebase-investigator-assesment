import crypto from "node:crypto";
import { buildCodeChunks, CodeChunk } from "@/lib/index/chunker";
import { callEmbeddingModel } from "@/lib/llm/client";
import { QuestionType } from "@/lib/contracts/questionTypeSchema";

export interface RetrievalResult {
  chunks: CodeChunk[];
  diagnostics: {
    strategy: "hybrid" | "lexical_only";
    totalChunks: number;
    returnedChunks: number;
    cacheHit: boolean;
  };
}

const retrievalCache = new Map<string, RetrievalResult>();
const embeddingCache = new Map<string, number[]>();
const chunkCache = new Map<string, CodeChunk[]>();

function scoreChunk(chunk: CodeChunk, terms: string[]): number {
  const text = `${chunk.filePath}\n${chunk.content}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    if (text.includes(term)) score += 2;
    const pieces = term.split(/[^a-z0-9_]+/).filter(Boolean);
    for (const piece of pieces) {
      if (piece.length <= 2) continue;
      if (text.includes(piece)) score += 1;
    }
  }
  if (chunk.symbolName && terms.some((term) => chunk.symbolName?.toLowerCase().includes(term))) {
    score += 3;
  }
  return score;
}

function pathPriorScore(chunk: CodeChunk, question: string): number {
  const q = question.toLowerCase();
  const p = chunk.filePath.toLowerCase();
  if ((q.includes("auth") || q.includes("signup") || q.includes("login")) && /(auth|session|middleware)/.test(p)) {
    return 3;
  }
  if ((q.includes("error") || q.includes("exception")) && /(error|api|handler)/.test(p)) {
    return 2;
  }
  if (q.includes("service") && p.includes("service")) {
    return 1.5;
  }
  return 0;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getRepoChunks(repoRoot: string, repoSha?: string): CodeChunk[] {
  const key = `${repoRoot}:${repoSha ?? "none"}`;
  const cached = chunkCache.get(key);
  if (cached) return cached;
  const built = buildCodeChunks(repoRoot);
  chunkCache.set(key, built);
  return built;
}

function buildCacheKey(input: {
  repoRoot: string;
  repoSha?: string;
  question: string;
  questionType?: QuestionType;
  limit: number;
}) {
  return crypto
    .createHash("sha1")
    .update(`${input.repoRoot}:${input.repoSha ?? "none"}:${input.question}:${input.questionType ?? "none"}:${input.limit}`)
    .digest("hex");
}

export async function retrieveContext(input: {
  repoRoot: string;
  repoSha?: string;
  question: string;
  questionType?: QuestionType;
  limit?: number;
}): Promise<RetrievalResult> {
  const limit = input.limit ?? 8;
  const cacheKey = buildCacheKey({ ...input, limit });
  const cached = retrievalCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      diagnostics: { ...cached.diagnostics, cacheHit: true }
    };
  }

  const chunks = getRepoChunks(input.repoRoot, input.repoSha);
  const terms = input.question.toLowerCase().split(/\s+/).filter(Boolean);
  const lexicalCandidates = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, terms) + pathPriorScore(chunk, input.question)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit * 4, 24));

  let strategy: RetrievalResult["diagnostics"]["strategy"] = "lexical_only";
  let rescored = lexicalCandidates;
  const queryEmbedding = await callEmbeddingModel([input.question]);
  if (queryEmbedding?.[0]) {
    const queryVector = queryEmbedding[0];
    const embedInputs: string[] = [];
    const embedIndexes: number[] = [];
    lexicalCandidates.forEach((item, idx) => {
      if (!embeddingCache.has(item.chunk.contentHash)) {
        embedInputs.push(`${item.chunk.filePath}\n${item.chunk.content.slice(0, 1500)}`);
        embedIndexes.push(idx);
      }
    });
    if (embedInputs.length > 0) {
      const vectors = await callEmbeddingModel(embedInputs);
      if (vectors && vectors.length === embedInputs.length) {
        vectors.forEach((vec, idx) => {
          embeddingCache.set(lexicalCandidates[embedIndexes[idx]].chunk.contentHash, vec);
        });
      }
    }

    rescored = lexicalCandidates.map((item) => {
      const vector = embeddingCache.get(item.chunk.contentHash);
      const semanticScore = vector ? cosineSimilarity(queryVector, vector) * 5 : 0;
      const questionTypeBoost =
        input.questionType === "evaluation_risk" && /throw|error|fail/i.test(item.chunk.content) ? 1 : 0;
      return {
        ...item,
        score: item.score + semanticScore + questionTypeBoost
      };
    });
    strategy = "hybrid";
  }

  const selected = rescored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);

  const result: RetrievalResult = {
    chunks: selected.length > 0 ? selected : chunks.slice(0, limit),
    diagnostics: {
      strategy,
      totalChunks: chunks.length,
      returnedChunks: selected.length > 0 ? selected.length : Math.min(chunks.length, limit),
      cacheHit: false
    }
  };
  retrievalCache.set(cacheKey, result);
  return result;
}

export function warmChunkCache(repoRoot: string, repoSha?: string): number {
  return getRepoChunks(repoRoot, repoSha).length;
}

export function getRetrievalCacheStats() {
  return {
    retrievalEntries: retrievalCache.size,
    embeddingEntries: embeddingCache.size,
    repoChunkEntries: chunkCache.size
  };
}
