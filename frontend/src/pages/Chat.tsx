// frontend/src/pages/Chat.tsx

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { ChatMessage } from "../lib/chatApi";
import { improveIdea, updateIdea } from "../lib/ideasApi";
import type { ImprovedIdeaResult } from "../lib/ideasApi";
import { editScriptWithAI, unlockScriptApi } from "../lib/chatApi";
import InstagramPreview from "../components/InstagramPreview";

// ── Typewriter & Smart CTA Parser ────────────────────────────────────────────
function TypewriterText({
  text,
  isNew,
  ctaIntent,
  fallbackCtaText,
  onCtaClick,
}: {
  text: string;
  isNew: boolean;
  ctaIntent?: string;
  fallbackCtaText?: string;
  onCtaClick?: (txt: string, intent: string) => void;
}) {
  const [displayed, setDisplayed] = useState(isNew ? "" : text);
  const [isTypingFinished, setIsTypingFinished] = useState(!isNew);

  useEffect(() => {
    if (!isNew) {
      setDisplayed(text);
      setIsTypingFinished(true);
      return;
    }

    setIsTypingFinished(false);
    let i = 0;
    const interval = setInterval(() => {
      i += 2;
      if (i >= text.length) {
        clearInterval(interval);
        setDisplayed(text);
        setIsTypingFinished(true);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, 15);

    return () => clearInterval(interval);
  }, [text, isNew]);

  if (ctaIntent && onCtaClick && isTypingFinished) {
    const lastQIndex = text.lastIndexOf("?");
    if (lastQIndex !== -1) {
      const snippet = text.substring(0, lastQIndex);
      const match = snippet.match(/[\.\!\n]\s*([^\.\!\n]*)$/);

      let startIndex = 0;
      if (match && match.index !== undefined) {
        startIndex = match.index + match[0].indexOf(match[1]);
      }

      const baseText = text.substring(0, startIndex);
      const ctaText = text.substring(startIndex);

      return (
        <p className="whitespace-pre-wrap">
          {baseText}
          <span
            onClick={() => onCtaClick(fallbackCtaText || "Yes, generate it 🚀", ctaIntent)}
            className="cursor-pointer font-semibold text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400/60 dark:decoration-indigo-500/60 decoration-dashed underline-offset-4 hover:text-indigo-800 dark:hover:text-indigo-300 transition-all duration-200"
            title="Click to auto-send"
          >
            {ctaText}
          </span>
        </p>
      );
    }
  }

  return <p className="whitespace-pre-wrap">{displayed}</p>;
}

// ── Chat Helpers ─────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const[copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  },[text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg px-2 py-1 transition-colors"
    >
      {copied ? "Copied" : "Copy"}
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

// ── Quick Suggestions ────────────────────────────────────────────────────────
const QUICK_SUGGESTIONS =[
  "Generate hooks for this",
  "Write a caption",
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

// ── Improve Idea Action Strip ────────────────────────────────────────────────
function WeakScoreActions({ onImprove, onDismiss, loading }: { onImprove: () => void; onDismiss: () => void; loading?: boolean }) {
  return (
    <div className="pl-10 mt-1">
      <div className="inline-flex items-center gap-2 p-1 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
        <button
          type="button"
          onClick={onImprove}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <Spinner size={12} /> : null}
          {loading ? "Improving..." : "Improve this idea 🚀"}
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

// ── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  message,
  isLatestAiMsg,
  plan,
  onSendIntent,
  onSaveSelection,
  onEditScript,
  onUnlockAndEdit,
  onRegenerateHook,
  onRegenerateCaption,
  onUpgrade,
  hideRegenerateBtn,
  hideRegenerateCaptionBtn,
}: {
  message: ChatMessage;
  isLatestAiMsg: boolean;
  plan: string;
  onSendIntent: (txt: string, intent: string) => void;
  onSaveSelection: (type: "hook" | "caption" | "script", text: string) => void;
  onEditScript: (scriptText: string) => void;
  onUnlockAndEdit: (msgId: string, text: string) => void;
  onRegenerateHook?: () => void;
  onRegenerateCaption?: () => void;
  onUpgrade: () => void;
  hideRegenerateBtn?: boolean;
  hideRegenerateCaptionBtn?: boolean;
}) {
  const isUser = message.source === "user";
  const meta: any = message.metadata || {};

  const hasQuestionMark = message.content.includes("?");
  const showInlineCta =!isUser && meta.cta && meta.type !== "hook_selection" && hasQuestionMark;
  const showStandaloneCta = !isUser && meta.cta && !["hook_selection", "caption_selection", "editable_script"].includes(meta.type) && !hasQuestionMark;
  const isLocked = meta.is_locked === true;

  const parseScript = (text: string) => {
    const hookMatch = text.match(/Hook:\s*([\s\S]*?)(?=\n+Body:|$)/i);
    return hookMatch ? hookMatch[1].trim() : text.slice(0, 150) + "...";
  };

  return (
    <div className={`flex w-full gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center self-end mb-0.5 shadow-sm ${
          isUser ? "bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400" : "bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 text-slate-800 dark:text-zinc-200"
        }`}
      >
        {isUser ? "👤" : "✨"}
      </div>

      <div className={`flex flex-col max-w-[78%] sm:max-w-[70%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`relative group px-4 py-3 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
            isUser ? "bg-indigo-600 dark:bg-indigo-500 text-white rounded-tr-sm" : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <TypewriterText
              text={message.content}
              isNew={isLatestAiMsg}
              ctaIntent={showInlineCta ? meta.cta : undefined}
              fallbackCtaText={meta.cta_text}
              onCtaClick={onSendIntent}
            />
          )}

          {!isUser && (
            <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={message.content} />
            </div>
          )}
        </div>

        {showStandaloneCta && (
          <button
            onClick={() => onSendIntent(meta.cta_text || "Continue 🚀", meta.cta)}
            className="mt-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            {meta.cta_text || "Continue 🚀"}
          </button>
        )}

        {/* ── STRUCTURED HOOK WIDGET WITH CONTAINER ── */}
        {!isUser && meta.type === "hook_selection" && meta.options && (
          <div className="mt-3 flex flex-col w-full max-w-sm">
            <div className="flex flex-col w-full bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 p-3 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3 ml-1 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Select a Hook
              </h4>

              <div className="flex flex-col gap-3">
                {meta.options.map((hookText: string, idx: number) => (
                  <div key={idx} className="relative w-full">
                    {/* 🟢 NEW: Visual Recommended Badge on the First Hook */}
                    {idx === 0 && (
                      <div className="absolute -top-2.5 right-3 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm z-10 flex items-center gap-1 pointer-events-none">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        Recommended
                      </div>
                    )}
                    <button
                      onClick={() => onSaveSelection("hook", hookText)}
                      className={`w-full text-left p-3.5 rounded-xl border text-[13.5px] leading-relaxed transition-all active:scale-[0.99] ${
                        idx === 0 
                          ? "bg-orange-50/50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-slate-800 dark:text-zinc-100 hover:border-orange-400 dark:hover:border-orange-500/50 hover:shadow-md"
                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10"
                      }`}
                    >
                      {hookText}
                    </button>
                  </div>
                ))}
              </div>

              {/* Regenerate Hooks Logic */}
              {onRegenerateHook && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-700">
                  {hideRegenerateBtn ? (
                    <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 bg-slate-100/50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/50 dark:border-zinc-700/50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Max Regenerations Reached
                    </div>
                  ) : (
                    <button
                      onClick={onRegenerateHook}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-[13px] font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate Hooks
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2.5 ml-1.5 text-[13px] font-medium text-slate-500 dark:text-zinc-500">
              👆 Choose a hook to continue
            </div>
            
          </div>
        )}

        {/* ── STRUCTURED CAPTION WIDGET WITH CONTAINER ── */}
        {!isUser && meta.type === "caption_selection" && meta.options && (
          <div className="mt-3 flex flex-col w-full max-w-sm">
            <div className="flex flex-col w-full bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 p-3 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3 ml-1 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Select a Caption
              </h4>

              <div className="flex flex-col gap-3">
                {meta.options.map((captionText: string, idx: number) => {
                  let badgeText = "Recommended (Medium)";
                  if (idx === 1) badgeText = "Short & Punchy";
                  if (idx === 2) badgeText = "Detailed Story";

                  return (
                    <div key={idx} className="relative w-full">
                      {/* Visual Badge */}
                      <div className={`absolute -top-2.5 right-3 px-2 py-0.5 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm z-10 flex items-center gap-1 pointer-events-none ${
                        idx === 0 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                        : 'bg-slate-400 dark:bg-zinc-600'
                      }`}>
                        {idx === 0 && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        )}
                        {badgeText}
                      </div>

                      <button
                        onClick={() => onSaveSelection("caption", captionText)}
                        className={`w-full text-left p-4 pt-4 rounded-xl border text-[13.5px] leading-relaxed transition-all active:scale-[0.99] whitespace-pre-wrap ${
                          idx === 0 
                            ? "bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-slate-800 dark:text-zinc-100 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md"
                            : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10"
                        }`}
                      >
                        {captionText}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Regenerate Captions Logic */}
              {onRegenerateCaption && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-700">
                  {hideRegenerateCaptionBtn ? (
                    <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 bg-slate-100/50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/50 dark:border-zinc-700/50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      Max Regenerations Reached
                    </div>
                  ) : (
                    <button onClick={onRegenerateCaption} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-[13px] font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all shadow-sm active:scale-[0.98]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Regenerate Captions
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="mt-2.5 ml-1.5 text-[13px] font-medium text-slate-500 dark:text-zinc-500">👆 Choose a caption to finish</div>
          </div>
        )}

        {/* ── EDITABLE SCRIPT BOX (UPDATED & FIXED) ── */}
        {!isUser && meta.type === "editable_script" && meta.script_text && (
          <div className="mt-3 w-full max-w-sm">
            <div className="relative group w-full">
              <div className="bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4 shadow-sm overflow-hidden relative">
                
                {(() => {
                  // Script ko parts mein todne ka logic
                  const parts = { hook: "", body: "", cta: "" };
                  const hookMatch = meta.script_text.match(/Hook:\s*([\s\S]*?)(?=\n+Body:|$)/i);
                  const bodyMatch = meta.script_text.match(/Body:\s*([\s\S]*?)(?=\n+CTA:|$)/i);
                  const ctaMatch = meta.script_text.match(/CTA:\s*([\s\S]*?)$/i);
                  
                  if (hookMatch || bodyMatch || ctaMatch) {
                    parts.hook = hookMatch ? hookMatch[1].trim() : "";
                    parts.body = bodyMatch ? bodyMatch[1].trim() : "";
                    parts.cta = ctaMatch ? ctaMatch[1].trim() : "";
                  } else {
                    parts.body = meta.script_text; // Fallback if format is missed
                  }
                  
                  return (
                    <>
                      {/* Always visible Hook section (if found) */}
                      {parts.hook && (
                        <div className="mb-3">
                          <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider mb-1 block">
                            Hook
                          </span>
                          <p className="text-[13px] leading-relaxed text-slate-700 dark:text-zinc-300 font-medium">
                            {parts.hook}
                          </p>
                        </div>
                      )}

                      {/* Body Section */}
                      <div className="relative">
                        <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider mb-1 block">
                          Body
                        </span>

                        {meta.is_locked ? (
                          // 🔒 LOCKED STATE (Generated while Free)
                          <div className="relative mt-1">
                            <div className="h-16 bg-gradient-to-b from-slate-200/60 to-transparent dark:from-zinc-800/60 rounded-lg border border-slate-300/50 dark:border-zinc-700/50 pointer-events-none blur-[2px] opacity-80"></div>
                            
                            <button
                              onClick={() => plan === "free" ? onUpgrade() : onUnlockAndEdit(message.id, meta.script_text)}
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-full shadow-md transition-all active:scale-95 z-10 whitespace-nowrap"
                            >
                              {plan === "free" ? (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                  Upgrade to Unlock
                                </>
                              ) : (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                  Unlock & Edit Script ✨
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          // 📖 UNLOCKED STATE (Generated while Pro/Starter)
                          <div className="relative mt-1">
                            <div className="max-h-28 overflow-hidden relative mb-8">
                              <p className="text-[13px] leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                                {parts.body}
                              </p>
                              {parts.cta && (
                                <p className="text-[13px] leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap mt-2">
                                  <span className="font-semibold text-indigo-400 dark:text-indigo-500">CTA: </span>
                                  {parts.cta}
                                </p>
                              )}
                              {/* Bottom Gradient Fade */}
                              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-indigo-50 dark:from-zinc-900 via-indigo-50/80 dark:via-zinc-900/80 to-transparent pointer-events-none" />
                            </div>
                            
                            <button
                              onClick={() => onEditScript(meta.script_text)}
                              className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-full shadow-md transition-all active:scale-95 z-10 whitespace-nowrap"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Review & Edit Script
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
                
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex flex-row gap-2.5 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 flex items-center justify-center self-end mb-0.5 shadow-sm">
        <span>✨</span>
      </div>
      <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-500 rounded-full animate-bounce[animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-500 rounded-full animate-bounce[animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-500 rounded-full animate-bounce[animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ── Main Chat Component ──────────────────────────────────────────────────────
export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { state, bottomRef, setInputText, handleSend, handleUpdateIdeaData, handleSaveSelection } = useChat(chatId ?? "");
  const { chat, messages, inputText, loading, sending } = state;

  // ── Plan Fetching ──
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    if (!user) return;
    const fetchPlan = async () => {
      const { data } = await supabase.from("user_profile").select("plan").eq("id", user.id).single();
      if (data?.plan) setPlan(data.plan.toLowerCase());
    };
    fetchPlan();
  }, [user]);

  // ── Modals & States ──
  const [weakScoreDismissed, setWeakScoreDismissed] = useState(false);
  const [improveLoading, setImproveLoading] = useState(false);
  const[improvedData, setImprovedData] = useState<ImprovedIdeaResult | null>(null);
  
  const[confirmHook, setConfirmHook] = useState<string | null>(null);
  const [confirmCaption, setConfirmCaption] = useState<string | null>(null);
  const [editingScript, setEditingScript] = useState<string | null>(null);
  
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const[confirmScriptUpdate, setConfirmScriptUpdate] = useState<string | null>(null);

  const [isUnlockingScript, setIsUnlockingScript] = useState(false);
  const [unlockedScriptsLocal, setUnlockedScriptsLocal] = useState<Record<string, string>>({});

  // ── View Toggle State ──
  const [activeView, setActiveView] = useState<"chat" | "preview">("chat");

  // ── AI Edit Script States ──
  const[aiEditPrompt, setAiEditPrompt] = useState("");
  const [isAiEditing, setIsAiEditing] = useState(false);

  // ── Undo Toast States ──
  const[originalScriptForUndo, setOriginalScriptForUndo] = useState<string | null>(null);
  const[undoData, setUndoData] = useState<{ oldText: string; newText: string } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Unsaved Changes Logic ──
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const hasUnsavedScriptChanges = editingScript !== null && editingScript !== originalScriptForUndo;

  const handleCloseScriptModal = () => {
    if (hasUnsavedScriptChanges) {
      setShowDiscardAlert(true);
    } else {
      setEditingScript(null);
      setAiEditPrompt("");
    }
  };

  const confirmDiscardScriptChanges = () => {
    setShowDiscardAlert(false);
    setEditingScript(null);
    setAiEditPrompt("");
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedScriptChanges) {
        e.preventDefault();
        e.returnValue = ""; 
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedScriptChanges]);

  const showUndoToast = (oldText: string, newText: string) => {
    setUndoData({ oldText, newText });
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setUndoData(null), 5000);
  };

  const handleUndoScript = () => {
    if (undoData) {
      handleSaveSelection("script", undoData.oldText);
      setUndoData(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    }
  };

  const handleUnlockAndEdit = async (msgId: string, lockedText: string) => {
    setEditingScript(""); 
    setOriginalScriptForUndo("");
    setIsUnlockingScript(true);
    
    try {
      const res = await unlockScriptApi(chatId!);
      setEditingScript(res.script);
      setOriginalScriptForUndo(res.script); 
      
      // 🟢 Ab TypeScript ko pata hai ki msgId kahan se aa raha hai
      setUnlockedScriptsLocal((prev) => ({ ...prev, [msgId]: res.script }));
    } catch (err) {
      console.error(err);
      setWarningMessage("Failed to unlock script. Please try again.");
      setEditingScript(null); 
    } finally {
      setIsUnlockingScript(false);
    }
  };

  // ── Hook & Caption Metrics & Logic ──
  const maxGenerationsAllowed = plan === "pro" ? 3 : plan === "starter" ? 2 : 1;
  
  const hookSelectionMessages = messages.filter((m) => m.metadata?.type === "hook_selection");
  const hookGenerationsCount = hookSelectionMessages.length;
  const maxHooksReached = hookGenerationsCount >= maxGenerationsAllowed; 
  const latestHookMsgId = hookSelectionMessages[hookSelectionMessages.length - 1]?.id;
  const hasSelectedHook = messages.some((m) => m.metadata && m.metadata.cta === "generate_script");
  
  const captionSelectionMessages = messages.filter((m) => m.metadata?.type === "caption_selection");
  const captionGenerationsCount = captionSelectionMessages.length;
  const maxCaptionsReached = captionGenerationsCount >= maxGenerationsAllowed;
  const latestCaptionMsgId = captionSelectionMessages[captionSelectionMessages.length - 1]?.id;
  const hasSelectedCaption = messages.some((m) => m.source === "assistant" && (m.content.includes("All done!") || m.content.includes("Ho gaya! Post drafts")));

  const maxScriptsReached = messages.some((m) => m.metadata?.type === "editable_script" && !m.metadata?.is_locked);
  const hasLockedScript = messages.some((m) => m.metadata?.type === "editable_script" && m.metadata?.is_locked);

  const getLimitWarning = (type: "hook" | "caption") => {
    const TypeName = type === "hook" ? "Hook" : "Caption";
    if (plan === "free") return `${TypeName} regeneration is not available on the Free plan. Please select an option provided or upgrade your plan.`;
    if (plan === "starter") return `You have reached the limit of 1 ${type} regeneration on the Starter plan. Please select an option provided.`;
    return `You have already reached the maximum limit of ${type} regenerations. Please select an option provided above.`;
  };

  const handleUserSend = async (overrideText?: string, explicitIntent?: string) => {
    // Sirf Button Clicks (explicitIntent) ke liye strict frontend validation lagayenge.
    // Typed text pe ab koi restriction nahi hai, use backend ka AI khud samajh lega.

    // 1. Hook Explicit Requests (From CTA buttons)
    if (explicitIntent === "generate_hooks") {
      if (maxScriptsReached) {
        setWarningMessage("You cannot generate new hooks because the script has already been generated based on your selected hook. Please edit the script directly if you want to make changes.");
        return;
      }
      if (maxHooksReached) {
        setWarningMessage(getLimitWarning("hook"));
        return;
      }
    }

    // 2. Caption Explicit Requests (From CTA buttons)
    if (explicitIntent === "generate_caption") {
      if (maxCaptionsReached) {
        setWarningMessage(getLimitWarning("caption"));
        return;
      }
    }
    
    // 3. Script Explicit Requests (From CTA buttons)
    if (explicitIntent === "generate_script") {
      if (!hasSelectedHook) {
        setWarningMessage("Please select a hook first! The script will be generated seamlessly continuing from your chosen hook.");
        return;
      }
      if (maxScriptsReached) {
        setWarningMessage("You have already generated a script! You can only generate it once. Please review and edit the existing script above.");
        return;
      }
      if (hasLockedScript && plan === "free") {
        setWarningMessage("You've already generated a locked script. Please upgrade to unlock it!");
        return;
      }
    }

    setWeakScoreDismissed(true);
    
    // Message send karo
    const res = await handleSend(overrideText, explicitIntent);

    // Agar backend ne bola ki user limit cross kar chuka hai, tab warning dikhao
    if (res && res.limitReached === "hook") setWarningMessage(getLimitWarning("hook"));
    else if (res && res.limitReached === "hook_post_script") setWarningMessage("You cannot generate new hooks because the script has already been generated. Please edit the script directly.");
    else if (res && res.limitReached === "script") setWarningMessage("You have already generated a script! You can only generate it once. Please review and edit the existing script above.");
    else if (res && res.limitReached === "caption") setWarningMessage(getLimitWarning("caption"));
  };

  const handleAiEditScript = async () => {
    if (!aiEditPrompt.trim() || !editingScript || !chatId) return;
    
    setIsAiEditing(true);
    try {
      const res = await editScriptWithAI(chatId, editingScript, aiEditPrompt);
      setEditingScript(res.updated_script);
      setAiEditPrompt("");
    } catch (err) {
      console.error(err);
      setWarningMessage("Failed to edit script using AI. Please try again.");
    } finally {
      setIsAiEditing(false);
    }
  };

  // ── Improve Idea Logic ──
  const firstAssistantMsg = messages.find((m) => m.source === "assistant");
  const openingWinScore: number | null = (firstAssistantMsg?.metadata?.win_score as number) ?? null;
  const hasUserMessage = messages.some((m) => m.source === "user");
  const showWeakScoreActions = openingWinScore !== null && openingWinScore < 7 && !weakScoreDismissed && !hasUserMessage;

  const handleImproveClick = async () => {
    if (!chat?.idea_id) return;
    setImproveLoading(true);
    try {
      const res = await improveIdea(chat.idea_id, chat.title);
      setImprovedData(res);
    } catch (err) {
      console.error(err);
      setWeakScoreDismissed(true);
    } finally {
      setImproveLoading(false);
    }
  };

  const handleUseImproved = async () => {
    if (!chat?.idea_id || !chat?.id || !improvedData) return;
    try {
      const res = await updateIdea(chat.idea_id, chat.id, improvedData.improved_idea, improvedData.why_it_works, improvedData.win_score);
      handleUpdateIdeaData(improvedData.improved_idea, improvedData.win_score, res.new_opening_message);
      setImprovedData(null);
      setWeakScoreDismissed(true);
    } catch (err) {}
  };

  const handleKeepOld = () => {
    setImprovedData(null);
    setWeakScoreDismissed(true);
  };

  const onHookSelect = (hook: string) => {
    if (maxScriptsReached) {
      setWarningMessage("You cannot change the hook now because the script has already been generated based on it. If you want to make changes, please edit the script directly.");
      return;
    }
    if (hasSelectedHook) {
      setConfirmHook(hook);
    } else {
      handleSaveSelection("hook", hook);
    }
  };

  const confirmHookSelection = () => {
    if (confirmHook) {
      handleSaveSelection("hook", confirmHook);
      setConfirmHook(null);
    }
  };

  const onCaptionSelect = (caption: string) => {
    if (hasSelectedCaption) {
      setConfirmCaption(caption);
    } else {
      handleSaveSelection("caption", caption);
    }
  };

  const confirmCaptionSelection = () => {
    if (confirmCaption) {
      handleSaveSelection("caption", confirmCaption);
      setConfirmCaption(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Spinner size={24} />
      </div>
    );
  }

  // Determine if QuickSuggestions should show
  const hasAssistantMessage = messages.some((m) => m.source === "assistant");
  const showSuggestions = hasAssistantMessage && !hasUserMessage && !sending && !showWeakScoreActions;

  return (
    <div className="fixed inset-0 lg:left-60 pt-16 lg:pt-0 bg-slate-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
      
      {/* ── Undo Toast ── */}
      {undoData && (
        <div className="fixed top-20 lg:top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="flex items-center gap-4 bg-slate-900 dark:bg-zinc-800 border dark:border-zinc-700 text-white px-5 py-3 rounded-full shadow-2xl">
            <span className="text-sm font-medium">Script updated</span>
            <div className="w-px h-4 bg-slate-700" />
            <button
              onClick={handleUndoScript}
              className="text-sm font-bold text-indigo-400 hover:text-indigo-300 active:scale-95 transition-all uppercase tracking-wide"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Top Header with Toggle */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none z-20">
        
        {/* Left Side: Back Button & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-colors"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{chat?.title ?? "Chat"}</h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 uppercase tracking-wider font-semibold">Postra AI</p>
          </div>
        </div>

        {/* Right Side: Toggle Switch */}
        <div className="flex bg-slate-100 dark:bg-zinc-800/50 p-1 rounded-xl shadow-inner border border-slate-200/50 dark:border-zinc-700/50">
          <button
            onClick={() => setActiveView("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeView === "chat" 
              ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </button>
          <button
            onClick={() => setActiveView("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeView === "preview" 
              ? "bg-indigo-600 text-white shadow-sm" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4" />
            </svg>
            Preview
          </button>
        </div>
      </header>

      {/* ── CONDITIONAL VIEW (Chat or Preview) ── */}
      {activeView === "chat" ? (
        <>
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-8 space-y-6">
              {messages.map((msg, idx) => {
                // 🟢 NEW FIX: Agar message abhi local me unlock hua hai, toh usko instantly unlocked dikhao
                const isLocallyUnlocked = unlockedScriptsLocal[msg.id];
                const displayMsg = isLocallyUnlocked 
                  ? { 
                      ...msg, 
                      metadata: { ...msg.metadata, is_locked: false, script_text: unlockedScriptsLocal[msg.id] } 
                    } 
                  : msg;

                return (
                  <div key={displayMsg.id}>
                    <MessageBubble
                      message={displayMsg}
                      isLatestAiMsg={idx === messages.length - 1 && !sending && displayMsg.source === "assistant"}
                      plan={plan}
                      onUpgrade={() => navigate("/upgrade")}
                      onUnlockAndEdit={handleUnlockAndEdit}
                      onSendIntent={(txt, intent) => handleUserSend(txt, intent)}
                      onSaveSelection={(type, text) => {
                        setWeakScoreDismissed(true);
                        if (type === "hook") onHookSelect(text);
                        if (type === "caption") onCaptionSelect(text);
                      }}
                      onEditScript={(scriptText) => {
                        setOriginalScriptForUndo(scriptText);
                        setEditingScript(scriptText);
                      }}
                      onRegenerateHook={
                        displayMsg.id === latestHookMsgId ? () => handleUserSend("Regenerate hooks 🔄", "generate_hooks") : undefined
                      }
                      onRegenerateCaption={
                        displayMsg.id === latestCaptionMsgId ? () => handleUserSend("Regenerate captions 🔄", "generate_caption") : undefined
                      }
                      hideRegenerateBtn={maxHooksReached || maxScriptsReached}
                      hideRegenerateCaptionBtn={maxCaptionsReached}
                    />

                    {idx === 0 && displayMsg.source === "assistant" && showWeakScoreActions && (
                      <WeakScoreActions
                        onImprove={handleImproveClick}
                        onDismiss={() => setWeakScoreDismissed(true)}
                        loading={improveLoading}
                      />
                    )}
                  </div>
                );
              })}

              {showSuggestions && (
                <div className="pl-10">
                  <QuickSuggestions onSelect={(txt) => handleUserSend(txt)} visible={true} />
                </div>
              )}

              {sending && <TypingIndicator />}
              <div ref={bottomRef} className="h-4" />
            </div>
          </div>

          {/* Input Bar */}
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 z-10">
            <div className="max-w-[700px] mx-auto">
              <div className="flex items-end gap-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl p-1.5 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleUserSend();
                    }
                  }}
                  disabled={sending}
                  rows={1}
                  placeholder={sending ? "Postra is typing..." : "Reply to Postra..."}
                  className="flex-1 bg-transparent px-3 py-2.5 outline-none resize-none disabled:opacity-50 text-sm text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 self-center"
                  style={{ minHeight: "24px", maxHeight: "128px" }}
                />
                <button
                  onClick={() => handleUserSend()}
                  disabled={!inputText.trim() || sending}
                  className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all disabled:opacity-40 shadow-sm flex-shrink-0"
                >
                  {sending ? (
                    <Spinner size={14} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        // ── PREVIEW VIEW ──
        <InstagramPreview chatId={chatId} plan={plan} />
      )}

      {/* ── Warning Modal ── */}
      {warningMessage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden p-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold text-slate-900 dark:text-zinc-100">Action Not Allowed</h3>
            <p className="text-[14px] text-slate-500 dark:text-zinc-400 leading-relaxed">{warningMessage}</p>
            <button
              onClick={() => setWarningMessage(null)}
              className="w-full mt-3 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold transition-all active:scale-95"
            >
              Okay, got it
            </button>
          </div>
        </div>
      )}

      {/* ── Improve Idea Modal ── */}
      {improvedData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Improved Idea</h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">Score</span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{improvedData.win_score}/10</span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">New Angle</p>
                <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-3.5 rounded-2xl">
                  <p className="text-[15px] text-slate-800 dark:text-zinc-200 font-medium leading-relaxed">
                    {improvedData.improved_idea}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Why it works</p>
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800">
                  {improvedData.why_it_works}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/80 dark:bg-zinc-800/80 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleKeepOld}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
              >
                Keep Old
              </button>
              <button
                type="button"
                onClick={handleUseImproved}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-2"
              >
                Use This
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hook Replacement Modal ── */}
      {confirmHook && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Replace Hook?</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                You have already selected a hook. Do you want to overwrite it with this new one?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmHook(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmHookSelection}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Caption Replacement Modal ── */}
      {confirmCaption && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Replace Caption?</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                You have already saved a caption. Do you want to overwrite it with this new one?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmCaption(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmCaptionSelection}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Script Edit Modal ── */}
      {editingScript !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Edit Your Script</h3>
              <button
                onClick={handleCloseScriptModal}
                className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                disabled={isAiEditing || isUnlockingScript}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 bg-indigo-50/30 dark:bg-indigo-500/10 flex items-center gap-3">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-indigo-500">✨</span>
                </div>
                <input 
                  type="text" 
                  value={aiEditPrompt}
                  onChange={(e) => setAiEditPrompt(e.target.value)}
                  placeholder="Ask AI to edit (e.g., make it funnier, remove the 2nd line...)"
                  className="w-full bg-white dark:bg-zinc-950 border border-indigo-200 dark:border-indigo-500/30 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all disabled:opacity-50"
                  disabled={isAiEditing}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && aiEditPrompt.trim()) {
                      e.preventDefault();
                      handleAiEditScript();
                    }
                  }}
                />
              </div>
              <button 
                onClick={handleAiEditScript}
                disabled={isAiEditing || !aiEditPrompt.trim()}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
              >
                {isAiEditing ? <Spinner size={14}/> : "Apply"}
              </button>
            </div>

            <div className="flex-1 p-5 bg-white dark:bg-zinc-900 overflow-hidden relative">
              <textarea
                value={editingScript}
                onChange={(e) => setEditingScript(e.target.value)}
                disabled={isAiEditing || isUnlockingScript}
                className={`w-full h-full resize-none outline-none text-[15px] text-slate-700 dark:text-zinc-200 leading-relaxed bg-transparent transition-opacity ${isAiEditing ? "opacity-40" : "opacity-100"}`}
                placeholder="Write your script here..."
              />
              
              {/* Spinner UI */}
              {(isAiEditing || isUnlockingScript) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-[1px]">
                  <Spinner size={28} />
                  <p className="mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    {isUnlockingScript ? "Unlocking and generating your script... ✨" : "AI is editing your script..."}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-end gap-3">
              <button
                onClick={handleCloseScriptModal}
                disabled={isAiEditing || isUnlockingScript}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmScriptUpdate(editingScript)}
                disabled={isAiEditing || isUnlockingScript || !hasUnsavedScriptChanges}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                Save Script
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unsaved Changes Discard Modal ── */}
      {showDiscardAlert && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 dark:text-zinc-100">Discard Changes?</h3>
              <p className="text-[14px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                You have unsaved edits in your script. If you close this now, all your changes will be lost.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDiscardAlert(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmDiscardScriptChanges}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all shadow-sm active:scale-95"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Script Update Confirmation Modal ── */}
      {confirmScriptUpdate !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 dark:text-zinc-100">Save Changes?</h3>
              <p className="text-[14px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                This will overwrite your existing script in your drafts. Do you want to proceed?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmScriptUpdate(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSaveSelection("script", confirmScriptUpdate);
                  showUndoToast(originalScriptForUndo || "", confirmScriptUpdate);
                  setConfirmScriptUpdate(null);
                  setEditingScript(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-sm active:scale-95"
              >
                Update Script
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}