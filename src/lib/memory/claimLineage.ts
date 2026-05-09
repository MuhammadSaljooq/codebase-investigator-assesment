import { ClaimLineageInput } from "@/lib/db/client";

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function overlap(a: string, b: string) {
  const sa = new Set(normalize(a).split(" ").filter((t) => t.length > 2));
  const sb = new Set(normalize(b).split(" ").filter((t) => t.length > 2));
  const common = [...sa].filter((term) => sb.has(term)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : common / union;
}

export function inferClaimLineage(
  priorClaims: Array<{ claim_key: string; statement: string }>,
  newClaims: Array<{ id: string; statement: string }>
): ClaimLineageInput[] {
  return newClaims.map((claim) => {
    let best: { key: string; score: number } | null = null;
    for (const prior of priorClaims) {
      const score = overlap(prior.statement, claim.statement);
      if (!best || score > best.score) {
        best = { key: prior.claim_key, score };
      }
    }
    if (!best || best.score < 0.45) {
      return { claimKey: claim.id, status: "new" as const };
    }
    const status = best.score > 0.9 ? "stable" : "updated";
    return {
      claimKey: claim.id,
      supersedesClaimKey: best.key,
      status
    };
  });
}
