import { LedgerSnapshot } from "@/lib/memory/claimLedger";

export interface ContradictionResult {
  notes: string[];
}

function normalizeStatement(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalizeStatement(text)
    .split(" ")
    .filter((token) => token.length > 2 && token !== "not" && token !== "does" && token !== "did");
}

function overlapScore(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function detectContradictions(
  ledger: LedgerSnapshot,
  newClaims: Array<{ statement: string }>
): ContradictionResult {
  const notes: string[] = [];
  const prior = ledger.claims.map((claim) => ({
    raw: claim.statement,
    normalized: normalizeStatement(claim.statement),
    tokens: tokenize(claim.statement)
  }));

  for (const claim of newClaims) {
    const normalized = normalizeStatement(claim.statement);
    if (!normalized) continue;
    const negated =
      normalized.includes(" not ") ||
      normalized.startsWith("not ") ||
      normalized.includes(" does not ") ||
      normalized.includes(" did not ");
    if (!negated) continue;
    const tokens = tokenize(claim.statement);
    for (const existing of prior) {
      const priorNegated =
        existing.normalized.includes(" not ") ||
        existing.normalized.includes(" does not ") ||
        existing.normalized.includes(" did not ");
      if (priorNegated) continue;
      if (overlapScore(tokens, existing.tokens) >= 0.45) {
        notes.push(
          `Possible contradiction with earlier claim: "${existing.raw}" vs "${claim.statement}".`
        );
        break;
      }
    }
  }

  return { notes };
}
