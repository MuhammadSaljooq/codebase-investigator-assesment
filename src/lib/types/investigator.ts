export type AuditVerdict = "trustworthy" | "caution" | "unreliable";

export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  evidenceQuote: string;
}

export interface RecommendationImpact {
  affectedFiles: string[];
  blastRadius: string;
  rollbackPlan: string;
  testImpact: string;
}

export interface AnswerClaim {
  id: string;
  statement: string;
  severity: "low" | "medium" | "high";
  uncertainty: string;
  citationIds: string[];
}

export interface AnswerData {
  questionType: string;
  answer: string;
  claims: AnswerClaim[];
  citations: Record<string, Citation>;
  uncertainties: string[];
  tradeoffs?: string[];
  breakageRisks?: string[];
  recommendationImpact?: RecommendationImpact;
}

export interface AuditData {
  verdict: AuditVerdict;
  score: number;
  findings: string[];
  hallucinatedCitations: string[];
  unsupportedClaims: string[];
  contradictionNotes: string[];
  remediationSuggestions: string[];
}

export interface RetrievalDiagnostics {
  strategy: "hybrid" | "lexical_only";
  cacheHit: boolean;
}

export interface TurnView {
  id: string;
  question: string;
  answer: AnswerData;
  audit: AuditData;
  retrievalDiagnostics?: RetrievalDiagnostics;
}

export interface ConversationSummary {
  id: number;
  title: string;
  repo_url: string;
  turn_count: number;
}

export interface HistoryCitationRow {
  citation_key: string;
  file_path: string;
  start_line: number;
  end_line: number;
  evidence_quote: string;
}

export interface HistoryClaimRow {
  claim_key: string;
  statement: string;
  severity?: "low" | "medium" | "high";
  uncertainty: string;
  citationKeys: string[];
}

export interface HistoryTurnRow {
  id: number;
  question: string;
  questionType: string;
  answer: string;
  uncertainties: string[];
  claims: HistoryClaimRow[];
  citations: HistoryCitationRow[];
  audit: AuditData;
}
