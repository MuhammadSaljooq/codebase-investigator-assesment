"use client";

import { ConversationSummary } from "@/lib/types/investigator";

interface ConversationSidebarProps {
  repoUrl: string;
  conversations: ConversationSummary[];
  selectedConversationId: number | null;
  isLoadingHistory: boolean;
  indexingState: string;
  onOpenConversation: (conversationId: number) => void;
}

function indexStatusClass(indexingState: string) {
  if (indexingState === "ready") return "status-dot active";
  if (indexingState === "indexing") return "status-dot busy";
  if (indexingState === "error") return "status-dot error";
  return "status-dot inactive";
}

export function ConversationSidebar({
  repoUrl,
  conversations,
  selectedConversationId,
  isLoadingHistory,
  indexingState,
  onOpenConversation
}: ConversationSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="t-title">Codebase Investigator</div>
        <p className="t-caption text-secondary mt-2">
          Investigation sessions with grounded audit trails.
        </p>
      </div>

      {repoUrl ? (
        <div className="repo-badge">
          <span className="repo-dot" />
          <span>{repoUrl}</span>
        </div>
      ) : null}

      <div className="sidebar-section-label">Conversations</div>
      <div className="sidebar-list">
        {conversations.length === 0 ? (
          <p className="t-caption text-muted">No conversations yet.</p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`sidebar-item ${selectedConversationId === conversation.id ? "active" : ""}`}
              onClick={() => onOpenConversation(conversation.id)}
              disabled={isLoadingHistory}
              title={conversation.repo_url}
            >
              <span className="item-icon">•</span>
              <span className="item-text">{conversation.title}</span>
              <span className="t-caption text-muted">{conversation.turn_count}</span>
            </button>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="status-row">
          <span className={indexStatusClass(indexingState)} />
          <span>index {indexingState}</span>
        </div>
      </div>
    </aside>
  );
}
