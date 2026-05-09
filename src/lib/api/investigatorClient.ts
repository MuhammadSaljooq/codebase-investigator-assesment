import {
  ConversationSummary,
  HistoryTurnRow,
  TurnView
} from "@/lib/types/investigator";

interface ApiEnvelope<T> {
  apiVersion: string;
  requestId: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    const snippet = body.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      response.ok
        ? `Unexpected non-JSON response from API.`
        : `API returned non-JSON error (${response.status}): ${snippet}`
    );
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Failed to parse API JSON response.`);
  }

  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? `Request failed (${response.status}).`);
  }
  return payload.data;
}

function hydrateTurn(row: HistoryTurnRow): TurnView {
  return {
    id: String(row.id),
    question: row.question,
    answer: {
      questionType: row.questionType,
      answer: row.answer,
      claims: row.claims.map((claim) => ({
        id: claim.claim_key,
        statement: claim.statement,
        severity: claim.severity ?? "medium",
        uncertainty: claim.uncertainty,
        citationIds: claim.citationKeys
      })),
      citations: Object.fromEntries(
        row.citations.map((citation) => [
          citation.citation_key,
          {
            filePath: citation.file_path,
            startLine: citation.start_line,
            endLine: citation.end_line,
            evidenceQuote: citation.evidence_quote
          }
        ])
      ),
      uncertainties: row.uncertainties
    },
    audit: row.audit
  };
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const data = await requestJson<{ conversations: ConversationSummary[] }>("/api/conversations");
  return data.conversations;
}

export async function ingestRepository(repoUrl: string): Promise<{ conversationId: number; indexingState: string }> {
  const data = await requestJson<{
    conversationId: number;
    indexing: { state: string };
  }>("/api/repo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl })
  });
  return {
    conversationId: data.conversationId,
    indexingState: data.indexing.state
  };
}

export async function fetchConversationHistory(
  conversationId: number
): Promise<{ turns: TurnView[] }> {
  const data = await requestJson<{ history: HistoryTurnRow[] }>(`/api/history/${conversationId}`);
  return { turns: data.history.map(hydrateTurn) };
}

export async function askInvestigatorQuestion(input: {
  conversationId: number;
  question: string;
}): Promise<{
  turn: TurnView;
}> {
  const data = await requestJson<{
    turnId: number;
    answer: TurnView["answer"];
    audit: TurnView["audit"];
    retrievalDiagnostics?: TurnView["retrievalDiagnostics"];
  }>("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return {
    turn: {
      id: String(data.turnId),
      question: input.question,
      answer: data.answer,
      audit: data.audit,
      retrievalDiagnostics: data.retrievalDiagnostics
    }
  };
}

export async function fetchIndexStatus(conversationId: number): Promise<string> {
  const data = await requestJson<{ status: { state: string } }>(
    `/api/index-status/${conversationId}`
  );
  return data.status.state;
}
