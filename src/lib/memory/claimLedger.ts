export interface LedgerClaim {
  turnIndex: number;
  claimId: string;
  statement: string;
  uncertainty: "known" | "inferred" | "speculative";
}

export interface LedgerSnapshot {
  claims: LedgerClaim[];
}

export function buildLedgerFromHistory(
  history: Array<{
    turnIndex: number;
    claims: Array<{ claim_key: string; statement: string; uncertainty: "known" | "inferred" | "speculative" }>;
  }>
): LedgerSnapshot {
  const claims: LedgerClaim[] = [];
  for (const turn of history) {
    for (const claim of turn.claims) {
      claims.push({
        turnIndex: turn.turnIndex,
        claimId: claim.claim_key,
        statement: claim.statement,
        uncertainty: claim.uncertainty
      });
    }
  }
  return { claims };
}
