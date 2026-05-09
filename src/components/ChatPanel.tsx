"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  askInvestigatorQuestion,
  fetchConversationHistory,
  fetchConversations,
  fetchIndexStatus,
  ingestRepository
} from "@/lib/api/investigatorClient";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { TurnMessage } from "@/components/chat/TurnMessage";
import { ConversationSummary, TurnView } from "@/lib/types/investigator";

export function ChatPanel() {
  const [repoUrl, setRepoUrl] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<TurnView[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexingState, setIndexingState] = useState<string>("idle");
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});

  const quickPrompts = [
    "How does auth work here, and what would you change?",
    "This signup flow feels off. Walk me through risks.",
    "Is there dead code? What is safe to delete?",
    "Suggest a better way to handle API errors."
  ];

  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  const contradictionBanner = useMemo(() => {
    if (!latestTurn || latestTurn.audit.contradictionNotes.length === 0) return null;
    return latestTurn.audit.contradictionNotes.join(" ");
  }, [latestTurn]);

  async function loadConversations() {
    try {
      const nextConversations = await fetchConversations();
      setConversations(nextConversations);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load conversations.");
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(async () => {
      try {
        const state = await fetchIndexStatus(conversationId);
        setIndexingState(state);
      } catch {
        // Keep polling resilient; avoid hard-failing the UI on transient index endpoint issues.
      }
    }, 1800);
    return () => clearInterval(interval);
  }, [conversationId]);

  async function ingestRepo() {
    setError(null);
    setIsLoading(true);
    try {
      const data = await ingestRepository(repoUrl);
      setConversationId(data.conversationId);
      setIndexingState(data.indexingState);
      setTurns([]);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function openConversation(nextConversationId: number) {
    setError(null);
    setIsLoadingHistory(true);
    try {
      const data = await fetchConversationHistory(nextConversationId);
      setConversationId(nextConversationId);
      setTurns(data.turns);
      setRepoUrl(
        conversations.find((entry) => entry.id === nextConversationId)?.repo_url ?? repoUrl
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function askQuestion() {
    if (!conversationId || !question.trim()) return;
    setError(null);
    setIsLoading(true);
    try {
      const data = await askInvestigatorQuestion({ conversationId, question });
      setTurns((prev) => [...prev, data.turn]);
      setQuestion("");
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleEvidence(turnId: string, citationKey: string) {
    const key = `${turnId}:${citationKey}`;
    setOpenEvidence((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void askQuestion();
    }
  }

  return (
    <div className="app-shell app-theme">
      <ConversationSidebar
        repoUrl={repoUrl}
        conversations={conversations}
        selectedConversationId={conversationId}
        isLoadingHistory={isLoadingHistory}
        indexingState={indexingState}
        onOpenConversation={(id) => void openConversation(id)}
      />
      <main className="app-main">
        <header className="app-header scanline-effect">
          <span className="logo">Investigator</span>
          <span className="logo-dot">/</span>
          <span className="t-caption text-secondary">Grounded answers + independent audit</span>
        </header>

        <section className="chat-area">
          <div className="chat-inner">
            {error ? <p className="state-error t-body mb-3">{error}</p> : null}
            {contradictionBanner ? (
              <div className="tool-disclosure mb-3">
                <span className="tool-icon">!</span>
                <span>Potential contradiction: {contradictionBanner}</span>
              </div>
            ) : null}
            {isLoadingHistory ? (
              <div className="skeleton">
                <div className="skeleton-line long" />
                <div className="skeleton-line medium" />
                <div className="skeleton-line short" />
              </div>
            ) : null}

            {turns.map((turn, index) => (
              <TurnMessage
                key={turn.id}
                turn={turn}
                index={index}
                previousAnswer={turns[index - 1]?.answer.answer}
                isEvidenceOpen={(citationKey) => Boolean(openEvidence[`${turn.id}:${citationKey}`])}
                onToggleEvidence={(citationKey) => toggleEvidence(turn.id, citationKey)}
              />
            ))}
          </div>
        </section>

        <footer className="input-area">
          <div className="input-area-inner">
            <div className="url-input-row">
              <span className="url-input-label">repo</span>
              <input
                className="url-input"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repo"
              />
              <button className="quick-chip" onClick={ingestRepo} disabled={isLoading || !repoUrl.trim()}>
                {conversationId ? "Re-ingest" : "Ingest"}
              </button>
            </div>

            <div className="question-row">
              <textarea
                className="question-input"
                rows={2}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Ask about auth, dead code, risk, architecture..."
                disabled={!conversationId}
              />
              <button className="send-btn" onClick={askQuestion} disabled={isLoading || !conversationId || !question.trim()}>
                ➤
              </button>
            </div>

            <div className="input-hints">
              <span className="input-hint">Cmd/Ctrl + Enter to send</span>
              <span className="input-hint">Shift + Enter for new line</span>
            </div>

            <div className="quick-prompts">
              {quickPrompts.map((prompt) => (
                <button key={prompt} className="quick-chip" onClick={() => setQuestion(prompt)} disabled={!conversationId}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="status-row">
              <span
                className={
                  indexingState === "ready"
                    ? "status-dot active"
                    : indexingState === "indexing"
                      ? "status-dot busy"
                      : indexingState === "error"
                        ? "status-dot error"
                        : "status-dot inactive"
                }
              />
              <span>Index status {indexingState}</span>
              {isLoading ? (
                <span className="thinking-dots">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </span>
              ) : null}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
