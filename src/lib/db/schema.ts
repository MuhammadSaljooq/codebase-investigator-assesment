export interface RepoSnapshot {
  id: number;
  repoUrl: string;
  localPath: string;
  commitSha: string;
  createdAt: string;
}

export interface Conversation {
  id: number;
  repoSnapshotId: number;
  title: string;
  createdAt: string;
}

export interface Turn {
  id: number;
  conversationId: number;
  turnIndex: number;
  question: string;
  questionType: string;
  answer: string;
  uncertaintiesJson: string;
  createdAt: string;
}

export interface Citation {
  id: number;
  turnId: number;
  citationKey: string;
  filePath: string;
  startLine: number;
  endLine: number;
  evidenceQuote: string;
}

export interface Claim {
  id: number;
  turnId: number;
  claimKey: string;
  statement: string;
  uncertainty: string;
  citationKeysJson: string;
}

export interface Audit {
  id: number;
  turnId: number;
  verdict: string;
  score: number;
  findingsJson: string;
  hallucinatedCitationsJson: string;
  unsupportedClaimsJson: string;
  contradictionNotesJson: string;
  remediationSuggestionsJson: string;
}
