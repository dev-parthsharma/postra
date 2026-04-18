// frontend/src/pages/Chat.tsx
// Light-themed to match the rest of the app.
// dark: variants for dark mode toggled via ThemeContext.
//
// Message alignment:
//   user     → justify-end  (RIGHT side, indigo bubble)
//   assistant → justify-start (LEFT side, white/slate bubble)

import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import type { ChatMessage, Hook, Caption, Hashtag } from "../lib/chatApi";

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
// Content Cards — light theme with dark: overrides
// ─────────────────────────────────────────────────────────────────────────────

function HookCard({ hook, onSelect, disabled }: { hook: Hook; onSelect: (t: string) => void; disabled: boolean }) {
  const styleColors: Record<string, string> = {
    Bold:     "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20",
    Question: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20",
    Story:    "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
  };
  const badgeClass = styleColors[hook.style] ?? "text-slate-500 bg-slate-100 border-slate-200";

  return (
    <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>{hook.style}</span>
        <CopyButton text={hook.text} />
      </div>
      <p className="text-slate-800 dark:text-zinc-100 text-sm leading-relaxed">{hook.text}</p>
      <button
        type="button" onClick={() => onSelect(hook.text)} disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {disabled ? <Spinner size={14} /> : "Use this hook →"}
      </button>
    </div>
  );
}

function CaptionCard({ caption, onSelect, disabled }: { caption: Caption; onSelect: (t: string) => void; disabled: boolean }) {
  const lengthColors: Record<string, string> = {
    Short:  "text-sky-600 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/20",
    Medium: "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-500/10 dark:border-violet-500/20",
    Long:   "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20",
  };
  const badgeClass = lengthColors[caption.length] ?? "text-slate-500 bg-slate-100 border-slate-200";

  return (
    <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>{caption.length}</span>
        <CopyButton text={caption.text} />
      </div>
      <p className="text-slate-800 dark:text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap">{caption.text}</p>
      <button
        type="button" onClick={() => onSelect(caption.text)} disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {disabled ? <Spinner size={14} /> : "Use this caption →"}
      </button>
    </div>
  );
}

function HashtagsCard({ hashtags, onSelect, disabled }: { hashtags: Hashtag[]; onSelect: (tags: string[]) => void; disabled: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(hashtags.map((h) => h.tag)));
  const toggle = (tag: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(tag) ? n.delete(tag) : n.add(tag); return n; });

  return (
    <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 dark:text-zinc-400 text-xs">Tap to toggle · {selected.size} selected</p>
        <CopyButton text={[...selected].join(" ")} />
      </div>
      <div className="flex flex-wrap gap-2">
        {hashtags.map((h) => (
          <button
            key={h.tag} type="button" onClick={() => toggle(h.tag)}
            className={`text-sm px-3 py-1 rounded-full border transition-all ${
              selected.has(h.tag)
                ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-500/40 dark:text-indigo-300"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {h.tag}
          </button>
        ))}
      </div>
      <button
        type="button" onClick={() => onSelect([...selected])} disabled={disabled || selected.size === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {disabled ? <Spinner size={14} /> : `Save ${selected.size} hashtag${selected.size !== 1 ? "s" : ""} →`}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble
// KEY: user → justify-end (right), assistant → justify-start (left)
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onSelectHook,
  onSelectCaption,
  onSelectHashtags,
  selecting,
}: {
  message: ChatMessage;
  onSelectHook: (text: string) => void;
  onSelectCaption: (text: string) => void;
  onSelectHashtags: (tags: string[]) => void;
  selecting: boolean;
}) {
  const isUser = message.source === "user";

  return (
    // CRITICAL: justify-end for user (right), justify-start for assistant (left)
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

      {/* Content */}
      <div className={`flex flex-col gap-3 max-w-[78%] sm:max-w-[70%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Text bubble */}
        {message.content && (
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm"
              : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-tl-sm shadow-sm"
          }`}>
            {message.content}
          </div>
        )}

        {/* Hook cards */}
        {message.type === "hooks" && message.metadata?.hooks && message.metadata.hooks.length > 0 && (
          <div className="w-full space-y-3">
            {message.metadata.hooks.map((hook) => (
              <HookCard key={hook.id} hook={hook} onSelect={onSelectHook} disabled={selecting} />
            ))}
          </div>
        )}

        {/* Caption cards */}
        {message.type === "captions" && message.metadata?.captions && message.metadata.captions.length > 0 && (
          <div className="w-full space-y-3">
            {message.metadata.captions.map((caption) => (
              <CaptionCard key={caption.id} caption={caption} onSelect={onSelectCaption} disabled={selecting} />
            ))}
          </div>
        )}

        {/* Hashtags card */}
        {message.type === "hashtags" && message.metadata?.hashtags && message.metadata.hashtags.length > 0 && (
          <div className="w-full">
            <HashtagsCard hashtags={message.metadata.hashtags} onSelect={onSelectHashtags} disabled={selecting} />
          </div>
        )}
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
// Done banner
// ─────────────────────────────────────────────────────────────────────────────

function DoneBanner({ onGoToDrafts }: { onGoToDrafts: () => void }) {
  return (
    <div className="flex flex-row gap-2.5 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-50 dark:bg-zinc-800 border border-emerald-200 dark:border-zinc-700 flex items-center justify-center self-start mt-0.5 shadow-sm">
        <span className="text-base leading-none">🚀</span>
      </div>
      <div className="bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl rounded-tl-sm p-5 space-y-3 max-w-sm shadow-sm">
        <div>
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Post is ready!</h3>
          <p className="text-slate-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
            Hook, caption, and hashtags saved. You're good to go.
          </p>
        </div>
        <button
          type="button" onClick={onGoToDrafts}
          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
        >
          View in Drafts →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat page
// ─────────────────────────────────────────────────────────────────────────────

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();

  const { state, bottomRef, setInputText, handleSend, handleSelectHook, handleSelectCaption, handleSelectHashtags } =
    useChat(chatId ?? "");

  const { chat, messages, stage, inputText, loading, sending, selecting, error } = state;
  const isDone = stage === "done";
  const isInputDisabled = sending || selecting || isDone;

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

  // ── Main layout ─────────────────────────────────────────────────────────────
  // Uses position:fixed to escape DashboardLayout's inner padding wrapper.
  // lg:left-60 offsets by sidebar width on desktop.
  // pt-16 lg:pt-0 offsets by mobile topbar.

  return (
    <div className="fixed inset-0 lg:left-60 pt-16 lg:pt-0 bg-slate-50 dark:bg-zinc-900 flex flex-col overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none">
        {/* Back */}
        <button
          type="button" onClick={() => navigate("/dashboard")}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0"
        >
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        {/* AI avatar */}
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
          <span className="text-base leading-none">✨</span>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
            {chat?.title ?? "Chat"}
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-600 leading-tight mt-0.5">AI-assisted post creation</p>
        </div>

        {/* Stage badge */}
        {!isDone ? (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-semibold text-indigo-600 dark:text-zinc-400 capitalize">{stage}</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-600">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Complete</span>
          </div>
        )}
      </header>

      {/* ── Scrollable messages ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-6 space-y-5">

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSelectHook={handleSelectHook}
              onSelectCaption={handleSelectCaption}
              onSelectHashtags={handleSelectHashtags}
              selecting={selecting}
            />
          ))}

          {sending && <TypingIndicator />}
          {isDone && <DoneBanner onGoToDrafts={() => navigate("/drafts")} />}

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
          {isDone ? (
            <p className="text-center text-slate-400 dark:text-zinc-600 text-xs py-1">
              This post workflow is complete. Start a new post from the dashboard.
            </p>
          ) : (
            <div className="flex items-end gap-3">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={isInputDisabled}
                rows={1}
                placeholder={sending ? "Postra is thinking…" : "Reply to Postra… (Enter to send, Shift+Enter for new line)"}
                className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/10 rounded-2xl px-4 py-3 text-slate-800 dark:text-zinc-100 text-sm placeholder-slate-400 dark:placeholder-zinc-600 outline-none resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
                style={{ minHeight: "48px", maxHeight: "128px" }}
              />
              <button
                type="button" onClick={handleSend}
                disabled={!inputText.trim() || isInputDisabled}
                className="flex-shrink-0 w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {sending ? <Spinner size={15} /> : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}