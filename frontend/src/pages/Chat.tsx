// frontend/src/pages/Chat.tsx
// Clean conversational chat — no forced hooks/captions/hashtags flow.
// User talks to Postra naturally; Postra generates content on request.

import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import type { ChatMessage } from "../lib/chatApi";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700"
    >
      {copied ? (
        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>Copied</>
      ) : (
        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copy</>
      )}
    </button>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble
// user → right (indigo), assistant → left (white/slate)
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.source === "user";

  return (
    <div className={`flex w-full gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>

      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center self-end mb-0.5 shadow-sm ${
        isUser
          ? "bg-indigo-100 dark:bg-zinc-700 border border-indigo-200 dark:border-zinc-600"
          : "bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700"
      }`}>
        {isUser ? (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="text-indigo-600 dark:text-zinc-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <span className="text-base leading-none">✨</span>
        )}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col max-w-[78%] sm:max-w-[70%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`relative group px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
          isUser
            ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm"
            : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-tl-sm shadow-sm"
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
          {!isUser && (
            <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={message.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weak score action strip
// Shown below the first assistant message when win_score < 7.
// Dismissed permanently once user clicks either button OR sends any message.
// ─────────────────────────────────────────────────────────────────────────────

interface WeakScoreActionsProps {
  onImprove: () => void;
  onDismiss: () => void;
}

function WeakScoreActions({ onImprove, onDismiss }: WeakScoreActionsProps) {
  return (
    <div className="pl-10 mt-1">
      <div className="inline-flex items-center gap-2 p-1 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
        <button
          type="button"
          onClick={onImprove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm shadow-orange-500/20"
        >
          Improve this idea 🚀
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing indicator
// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex flex-row gap-2.5 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 flex items-center justify-center self-end mb-0.5 shadow-sm">
        <span className="text-base leading-none">✨</span>
      </div>
      <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick suggestion chips — shown after first assistant message
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  "Generate hooks for this",
  "Write a caption",
  "Suggest hashtags",
  "Give me content angles",
  "What's the best hook style for this?",
];

function QuickSuggestions({ onSelect, visible }: { onSelect: (s: string) => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1 pb-2">
      {QUICK_SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="text-xs px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors font-medium"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat page
// ─────────────────────────────────────────────────────────────────────────────

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();

  const { state, bottomRef, setInputText, handleSend } = useChat(chatId ?? "");
  const { chat, messages, inputText, loading, sending, error } = state;

  // Tracks whether the user dismissed the weak-score action strip.
  // Default false = strip is visible until dismissed or user sends a message.
  const [weakScoreDismissed, setWeakScoreDismissed] = useState(false);

  // ── Derive win_score from the first assistant message metadata ────────────
  const firstAssistantMsg = messages.find((m) => m.source === "assistant");
  const openingWinScore: number | null =
    (firstAssistantMsg?.metadata as Record<string, unknown> | null)?.win_score as number ?? null;

  // Show the strip only when:
  //   • score is known AND below 7
  //   • user hasn't dismissed it
  //   • no user message yet (once they reply, it's implicitly "continue anyway")
  const hasUserMessage = messages.some((m) => m.source === "user");
  const showWeakScoreActions =
    openingWinScore !== null &&
    openingWinScore < 7 &&
    !weakScoreDismissed &&
    !hasUserMessage;

  // Quick suggestion chips: shown after first assistant message, before any user reply
  const hasAssistantMessage = messages.some((m) => m.source === "assistant");
  // Hide chips while weak-score strip is visible to avoid cluttering the UI
  const showSuggestions =
    hasAssistantMessage && !hasUserMessage && !sending && !showWeakScoreActions;

  const handleSuggestion = (text: string) => {
    setInputText(text);
    setTimeout(() => handleSend(), 50);
  };

  // Sending any message implicitly dismisses the strip
  const handleSendWithDismiss = useCallback(() => {
    setWeakScoreDismissed(true);
    handleSend();
  }, [handleSend]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 flex items-center justify-center animate-pulse">
            <span className="text-lg">✨</span>
          </div>
          <p className="text-slate-400 dark:text-zinc-500 text-sm">Loading your chat…</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error && !chat) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-900">
        <div className="text-center space-y-3">
          <p className="text-slate-500 dark:text-zinc-400 text-sm">{error}</p>
          <button type="button" onClick={() => navigate("/dashboard")} className="text-indigo-600 text-sm hover:underline">
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 lg:left-60 pt-16 lg:pt-0 bg-slate-50 dark:bg-zinc-900 flex flex-col overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none">
        <button
          type="button" onClick={() => navigate("/dashboard")}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0"
        >
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
          <span className="text-base leading-none">✨</span>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
            {chat?.title ?? "Chat"}
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-600 leading-tight mt-0.5">AI-assisted post creation</p>
        </div>
      </header>

      {/* ── Scrollable messages ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-6 space-y-6">

          {messages.map((msg, idx) => (
            <div key={msg.id}>
              <MessageBubble message={msg} />

              {/*
                Weak-score action strip — rendered directly after the first
                assistant message (idx === 0) when score < 7 and not dismissed.
                No blur, no overlay — message is always fully readable.
              */}
              {idx === 0 && msg.source === "assistant" && showWeakScoreActions && (
                <WeakScoreActions
                  onImprove={() => {
                    // Improve flow wired up in a later step — no-op for now
                    setWeakScoreDismissed(true);
                  }}
                  onDismiss={() => setWeakScoreDismissed(true)}
                />
              )}
            </div>
          ))}

          {/* Quick suggestion chips — shown only before user has replied */}
          {showSuggestions && (
            <div className="pl-10">
              <QuickSuggestions onSelect={handleSuggestion} visible={true} />
            </div>
          )}

          {sending && <TypingIndicator />}

          {error && chat && (
            <div className="flex justify-center">
              <p className="text-red-500 text-xs text-center bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-xl px-4 py-2.5">
                {error}
              </p>
            </div>
          )}

          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="max-w-[700px] mx-auto">
          <div className="flex items-end gap-3">
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendWithDismiss();
                }
              }}
              disabled={sending}
              rows={1}
              placeholder={sending ? "Postra is thinking…" : "Ask Postra anything — hooks, captions, angles… (Enter to send)"}
              className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/10 rounded-2xl px-4 py-3 text-slate-800 dark:text-zinc-100 text-sm placeholder-slate-400 dark:placeholder-zinc-600 outline-none resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
              style={{ minHeight: "48px", maxHeight: "128px" }}
            />
            <button
              type="button"
              onClick={() => {
                if (!inputText.trim()) return;
                handleSendWithDismiss();
              }}
              disabled={!inputText.trim() || sending}
              className="flex-shrink-0 w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {sending ? <Spinner size={15} /> : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-2 text-center">
            Ask for hooks, captions, hashtags, or anything else about your post
          </p>
        </div>
      </div>
    </div>
  );
}