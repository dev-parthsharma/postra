// frontend/src/pages/Chat.tsx
// Chat page — shown after user confirms an idea from NewPostModal.
// Sits inside DashboardLayout (sidebar visible).
// Free plan flow: Hooks → Captions → Hashtags → Done
//
// Field mapping:
//   message.source   = 'user' | 'assistant'
//   message.type     = 'text' | 'hooks' | 'captions' | 'hashtags'
//   message.metadata = { hooks?, captions?, hashtags? }

import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import type { ChatMessage, Hook, Caption, Hashtag } from "../lib/chatApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
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
      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-700"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </>
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

// ── Card components ───────────────────────────────────────────────────────────

function HookCard({
  hook,
  onSelect,
  disabled,
}: {
  hook: Hook;
  onSelect: (text: string) => void;
  disabled: boolean;
}) {
  const styleColors: Record<string, string> = {
    Bold:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
    Question: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    Story:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };
  const badgeClass = styleColors[hook.style] ?? "text-zinc-400 bg-zinc-700 border-zinc-600";

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>
          {hook.style}
        </span>
        <CopyButton text={hook.text} />
      </div>
      <p className="text-zinc-200 text-sm leading-relaxed">{hook.text}</p>
      <button
        type="button"
        onClick={() => onSelect(hook.text)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-500/20"
      >
        {disabled ? <Spinner size={14} /> : "Use this hook →"}
      </button>
    </div>
  );
}

function CaptionCard({
  caption,
  onSelect,
  disabled,
}: {
  caption: Caption;
  onSelect: (text: string) => void;
  disabled: boolean;
}) {
  const lengthColors: Record<string, string> = {
    Short:  "text-sky-400 bg-sky-500/10 border-sky-500/20",
    Medium: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    Long:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  const badgeClass = lengthColors[caption.length] ?? "text-zinc-400 bg-zinc-700 border-zinc-600";

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>
          {caption.length}
        </span>
        <CopyButton text={caption.text} />
      </div>
      <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">{caption.text}</p>
      <button
        type="button"
        onClick={() => onSelect(caption.text)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-500/20"
      >
        {disabled ? <Spinner size={14} /> : "Use this caption →"}
      </button>
    </div>
  );
}

function HashtagsCard({
  hashtags,
  onSelect,
  disabled,
}: {
  hashtags: Hashtag[];
  onSelect: (tags: string[]) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(hashtags.map((h) => h.tag))
  );

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const allText = [...selected].join(" ");

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-xs">Tap to toggle · {selected.size} selected</p>
        <CopyButton text={allText} />
      </div>
      <div className="flex flex-wrap gap-2">
        {hashtags.map((h) => (
          <button
            key={h.tag}
            type="button"
            onClick={() => toggle(h.tag)}
            className={`text-sm px-3 py-1 rounded-full border transition-all duration-150 ${
              selected.has(h.tag)
                ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                : "bg-zinc-700 border-zinc-600 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {h.tag}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSelect([...selected])}
        disabled={disabled || selected.size === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-500/20"
      >
        {disabled ? <Spinner size={14} /> : `Save ${selected.size} hashtag${selected.size !== 1 ? "s" : ""} →`}
      </button>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

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
  const isAssistant = message.source === "assistant";

  return (
    <div className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mt-0.5">
          <span className="text-sm">✨</span>
        </div>
      )}

      <div className={`max-w-[85%] space-y-3 ${isAssistant ? "" : "items-end flex flex-col"}`}>
        {/* Plain text content */}
        {message.content && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              isAssistant
                ? "bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-sm"
                : "bg-orange-500 text-white rounded-tr-sm shadow-md shadow-orange-500/20"
            }`}
          >
            {message.content}
          </div>
        )}

        {/* Hooks cards — message.type === 'hooks' */}
        {message.type === "hooks" && message.metadata?.hooks && message.metadata.hooks.length > 0 && (
          <div className="w-full space-y-3">
            {message.metadata.hooks.map((hook) => (
              <HookCard
                key={hook.id}
                hook={hook}
                onSelect={onSelectHook}
                disabled={selecting}
              />
            ))}
          </div>
        )}

        {/* Caption cards — message.type === 'captions' */}
        {message.type === "captions" && message.metadata?.captions && message.metadata.captions.length > 0 && (
          <div className="w-full space-y-3">
            {message.metadata.captions.map((caption) => (
              <CaptionCard
                key={caption.id}
                caption={caption}
                onSelect={onSelectCaption}
                disabled={selecting}
              />
            ))}
          </div>
        )}

        {/* Hashtags card — message.type === 'hashtags' */}
        {message.type === "hashtags" && message.metadata?.hashtags && message.metadata.hashtags.length > 0 && (
          <div className="w-full">
            <HashtagsCard
              hashtags={message.metadata.hashtags}
              onSelect={onSelectHashtags}
              disabled={selecting}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
        <span className="text-sm">✨</span>
      </div>
      <div className="bg-zinc-800 border border-zinc-700 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ── Done banner ───────────────────────────────────────────────────────────────

function DoneBanner({ onGoToDrafts }: { onGoToDrafts: () => void }) {
  return (
    <div className="mx-4 mb-4 bg-zinc-800 border border-orange-500/20 rounded-2xl p-5 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
        <span className="text-xl">🚀</span>
      </div>
      <div>
        <h3 className="text-white font-semibold text-base">Post is ready!</h3>
        <p className="text-zinc-400 text-sm mt-1">Hook, caption, and hashtags saved. You're good to go.</p>
      </div>
      <button
        type="button"
        onClick={onGoToDrafts}
        className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 shadow-lg shadow-orange-500/25"
      >
        View in Drafts →
      </button>
    </div>
  );
}

// ── Stage progress pill ───────────────────────────────────────────────────────

const STAGES = ["hooks", "captions", "hashtags", "done"] as const;
const STAGE_LABELS: Record<string, string> = {
  hooks: "Hooks", captions: "Captions", hashtags: "Hashtags", done: "Done",
};

function StagePill({ stage }: { stage: string }) {
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const stageIndex = STAGES.indexOf(stage as typeof STAGES[number]);
        const isCompleted = i < stageIndex;
        const isActive    = s === stage;

        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
              isActive
                ? "bg-orange-500/15 border-orange-500/40 text-orange-300 font-medium"
                : isCompleted
                ? "bg-zinc-700/50 border-zinc-600 text-zinc-500 line-through"
                : "bg-transparent border-zinc-700 text-zinc-600"
            }`}>
              {isCompleted && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {STAGE_LABELS[s]}
            </div>
            {i < STAGES.length - 1 && <div className="w-3 h-px bg-zinc-700" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Chat page ────────────────────────────────────────────────────────────

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate   = useNavigate();

  const {
    state,
    bottomRef,
    setInputText,
    handleSend,
    handleSelectHook,
    handleSelectCaption,
    handleSelectHashtags,
  } = useChat(chatId ?? "");

  const { chat, messages, stage, inputText, loading, sending, selecting, error } = state;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center animate-pulse">
            <span className="text-lg">✨</span>
          </div>
          <p className="text-zinc-500 text-sm">Loading your chat…</p>
        </div>
      </div>
    );
  }

  if (error && !chat) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="text-center space-y-3">
          <p className="text-zinc-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-orange-400 text-sm hover:underline"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const isDone = stage === "done";
  const isInputDisabled = sending || selecting || isDone;

  return (
    <div className="flex flex-col h-screen bg-zinc-900 overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-zinc-800 flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-white font-semibold text-sm truncate">{chat?.title ?? "Chat"}</h1>
            <p className="text-zinc-500 text-xs">Free plan · AI-assisted post creation</p>
          </div>
        </div>
        <div className="hidden sm:block flex-shrink-0">
          <StagePill stage={stage} />
        </div>
      </div>

      {/* Stage progress — mobile */}
      <div className="sm:hidden flex-shrink-0 px-4 py-2 border-b border-zinc-800">
        <StagePill stage={stage} />
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
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
          <p className="text-red-400 text-xs text-center bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mx-auto max-w-xs">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 sm:px-6 py-3">
        {isDone ? (
          <p className="text-center text-zinc-600 text-xs py-1">
            This post workflow is complete. Start a new post from the dashboard.
          </p>
        ) : (
          <div className="flex items-end gap-3 max-w-3xl mx-auto">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isInputDisabled}
              rows={1}
              placeholder={sending ? "Postra is thinking…" : "Reply to Postra… (Enter to send)"}
              className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-orange-500/60 rounded-xl px-4 py-2.5 text-zinc-200 text-sm placeholder-zinc-600 outline-none resize-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed max-h-32"
              style={{ minHeight: "42px" }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || isInputDisabled}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-orange-500/20"
              aria-label="Send message"
            >
              {sending ? (
                <Spinner size={14} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}