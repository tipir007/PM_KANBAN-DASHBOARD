"use client";

import { FormEvent, useState } from "react";
import { chatWithAI, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type Props = {
  username?: string;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onBoardUpdateFromAI: (board: BoardData) => void;
};

export const AIChatSidebar = ({
  username = "user",
  messages,
  onMessagesChange,
  onBoardUpdateFromAI,
}: Props) => {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || isSending) {
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, content: question }];
    onMessagesChange(nextMessages);
    setDraft("");
    setIsSending(true);
    setChatError(null);

    try {
      const result = await chatWithAI({
        username,
        question,
        conversation: messages,
      });
      const withAssistant = [
        ...nextMessages,
        { role: "assistant" as const, content: result.response },
      ];
      onMessagesChange(withAssistant);
      if (result.board_update) {
        onBoardUpdateFromAI(result.board_update);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reach AI service.";
      setChatError(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside className="rounded-[28px] border border-[var(--stroke)] bg-white/90 p-5 shadow-[var(--shadow)] backdrop-blur lg:sticky lg:top-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--primary-blue)]">
        AI Assistant
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
        Board Copilot
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
        Ask for planning help or direct board updates.
      </p>

      <div
        className="mt-4 flex max-h-[360px] min-h-[220px] flex-col gap-3 overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--gray-text)]">
            Start with a prompt like: move API tasks into In Progress.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
              className={`rounded-xl px-3 py-2 text-sm ${
                message.role === "assistant"
                  ? "border border-[var(--stroke)] bg-white text-[var(--navy-dark)]"
                  : "bg-[var(--secondary-purple)] text-white"
              }`}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] opacity-80">
                {message.role === "assistant" ? "Assistant" : "You"}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))
        )}
      </div>

      {chatError ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {chatError}
        </p>
      ) : null}

      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label htmlFor="ai-chat-input" className="text-sm font-medium text-[var(--navy-dark)]">
          Ask AI about your board
        </label>
        <textarea
          id="ai-chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          placeholder="Type your request..."
          className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={isSending}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
};
