// frontend\src\pages\Chat.tsx

import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import type { ChatMessage } from "../lib/chatApi";
import { improveIdea, updateIdea } from "../lib/ideasApi";
import type { ImprovedIdeaResult } from "../lib/ideasApi";

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
  const[displayed, setDisplayed] = useState(isNew ? "" : text);

  useEffect(() => {
    if (!isNew) {
      setDisplayed(text);
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i += 2;
      if (i > text.length) clearInterval(interval);
    }, 15);

    return () => clearInterval(interval);
  }, [text, isNew]);

  if (ctaIntent && onCtaClick && displayed === text) {
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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback silently
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg px-2 py-1 transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ── Improve Idea Action Strip ────────────────────────────────────────────────
function WeakScoreActions({
  onImprove,
  onDismiss,
  loading,
}: {
  onImprove: () => void;
  onDismiss: () => void;
  loading?: boolean;
}) {
  return (
    <div className="pl-10 mt-1">
      <div className="inline-flex items-center gap-2 p-1 rounded-2xl bg-amber-50 border border-amber-200">
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
          className="px-3 py-1.5 rounded-xl text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
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
  onSendIntent,
  onSaveSelection,
  onEditScript,
  onRegenerateHook,
  hideRegenerateBtn,
}: {
  message: ChatMessage;
  isLatestAiMsg: boolean;
  onSendIntent: (txt: string, intent: string) => void;
  onSaveSelection: (type: "hook" | "caption" | "script", text: string) => void;
  onEditScript: (scriptText: string) => void;
  onRegenerateHook?: () => void;
  hideRegenerateBtn?: boolean;
}) {
  const isUser = message.source === "user";
  const meta: any = message.metadata || {};

  const hasQuestionMark = message.content.includes("?");
  const showInlineCta =
    !isUser && meta.cta && !["hook_selection", "editable_script"].includes(meta.type) && hasQuestionMark;
  const showStandaloneCta =
    !isUser && meta.cta && !["hook_selection", "editable_script"].includes(meta.type) && !hasQuestionMark;

  return (
    <div className={`flex w-full gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center self-end mb-0.5 shadow-sm ${
          isUser ? "bg-indigo-100 border border-indigo-200 text-indigo-700" : "bg-indigo-50 border border-indigo-100"
        }`}
      >
        {isUser ? "👤" : "✨"}
      </div>

      <div className={`flex flex-col max-w-[78%] sm:max-w-[70%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`relative group px-4 py-3 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
            isUser ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
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
            className="mt-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            {meta.cta_text || "Continue 🚀"}
          </button>
        )}

        {/* ── STRUCTURED HOOK WIDGET WITH CONTAINER ── */}
        {!isUser && meta.type === "hook_selection" && meta.options && (
          <div className="mt-3 flex flex-col w-full max-w-sm">
            
            {/* The Hooks Box */}
            <div className="flex flex-col w-full bg-slate-50 rounded-2xl border border-slate-200 p-3 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Select a Hook
              </h4>

              <div className="flex flex-col gap-2">
                {meta.options.map((hookText: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => onSaveSelection("hook", hookText)}
                    className="text-left p-3.5 rounded-xl border text-[13.5px] leading-relaxed transition-all bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:shadow-md hover:bg-indigo-50/50 active:scale-[0.99]"
                  >
                    {hookText}
                  </button>
                ))}
              </div>

              {/* Regenerate Hooks Logic */}
              {onRegenerateHook && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  {hideRegenerateBtn ? (
                    <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 bg-slate-100/50 rounded-xl border border-slate-200/50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Max Regenerations Reached
                    </div>
                  ) : (
                    <button
                      onClick={onRegenerateHook}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[13px] font-semibold hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all shadow-sm active:scale-[0.98]"
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

            {/* ── NEW SCRIPT CTA LINE ── */}
            <div className="mt-2.5 ml-1.5 text-[13.5px] text-slate-500">
              Next step:{" "}
              <span
                onClick={() => onSendIntent("Write the full script 📝", "generate_script")}
                className="cursor-pointer font-semibold text-indigo-600 underline decoration-indigo-400/60 decoration-dashed underline-offset-4 hover:text-indigo-800 transition-all duration-200"
              >
                Generate full script
              </span>
            </div>
            
          </div>
        )}

        {/* ── EDITABLE SCRIPT BOX ── */}
        {!isUser && meta.type === "editable_script" && meta.script_text && (
          <div className="mt-3 relative group w-full max-w-sm">
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 shadow-sm overflow-hidden relative max-h-48">
              <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap line-clamp-6">
                {meta.script_text}
              </p>
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-indigo-50 via-indigo-50/80 to-transparent pointer-events-none" />
            </div>

            <button
              onClick={() => onEditScript(meta.script_text)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full shadow-md transition-all active:scale-95 z-10"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Review & Edit Script
            </button>
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
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center self-end mb-0.5 shadow-sm">
        <span>✨</span>
      </div>
      <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce[animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce[animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce[animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ── Main Chat Component ──────────────────────────────────────────────────────
export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { state, bottomRef, setInputText, handleSend, handleUpdateIdeaData, handleSaveSelection } = useChat(
    chatId ?? ""
  );
  const { chat, messages, inputText, loading, sending } = state;

  // ── Modals & States ──
  const[weakScoreDismissed, setWeakScoreDismissed] = useState(false);
  const [improveLoading, setImproveLoading] = useState(false);
  const [improvedData, setImprovedData] = useState<ImprovedIdeaResult | null>(null);
  const [confirmHook, setConfirmHook] = useState<string | null>(null);
  const[editingScript, setEditingScript] = useState<string | null>(null);
  const[warningMessage, setWarningMessage] = useState<string | null>(null);

  // ── Hook Metrics & Logic ──
  const hookSelectionMessages = messages.filter((m) => m.metadata?.type === "hook_selection");
  const hookGenerationsCount = hookSelectionMessages.length;
  const maxHooksReached = hookGenerationsCount >= 3; // Initial + 2 Regenerates
  const latestHookMsgId = hookSelectionMessages[hookSelectionMessages.length - 1]?.id;
  const hasSelectedHook = messages.some((m) => m.metadata && m.metadata.cta === "generate_script");

  // Custom send handler to intercept invalid generations
  const handleUserSend = async (overrideText?: string, explicitIntent?: string) => {
    // 1. Pre-check: Avoid hitting backend if user explicitly clicks Old CTA buttons
    const isOldCtaClick = explicitIntent?.includes("hook") || explicitIntent === "generate_hooks";

    if (maxHooksReached && isOldCtaClick) {
      setWarningMessage("You have already reached the maximum limit of 3 hook generations. Please select a hook from the options provided above.");
      return;
    }

    setWeakScoreDismissed(true);
    
    // 2. Wait for backend to process text and evaluate intent
    const res = await handleSend(overrideText, explicitIntent);

    // 3. Post-check: If Groq realizes it's a hook request AND limit is reached
    if (res && res.limitReached) {
      setWarningMessage("You have already reached the maximum limit of 3 hook generations. Please select a hook from the options provided above.");
    }
  };

  // ── Improve Idea Logic ──
  const firstAssistantMsg = messages.find((m) => m.source === "assistant");
  const openingWinScore: number | null = (firstAssistantMsg?.metadata?.win_score as number) ?? null;
  const hasUserMessage = messages.some((m) => m.source === "user");
  const showWeakScoreActions =
    openingWinScore !== null && openingWinScore < 7 && !weakScoreDismissed && !hasUserMessage;

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
      const res = await updateIdea(
        chat.idea_id,
        chat.id,
        improvedData.improved_idea,
        improvedData.why_it_works,
        improvedData.win_score
      );

      handleUpdateIdeaData(improvedData.improved_idea, improvedData.win_score, res.new_opening_message);
      setImprovedData(null);
      setWeakScoreDismissed(true);
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const handleKeepOld = () => {
    setImprovedData(null);
    setWeakScoreDismissed(true);
  };

  const onHookSelect = (hook: string) => {
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

  const handleScriptSave = () => {
    if (editingScript !== null) {
      handleSaveSelection("script", editingScript);
      setEditingScript(null);
    }
  };

  // ── Render Loading ──
  if (loading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-slate-50">
        <Spinner size={24} />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="fixed inset-0 lg:left-60 pt-16 lg:pt-0 bg-slate-50 flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 bg-white shadow-sm z-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 truncate">{chat?.title ?? "Chat"}</h1>
          <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">Postra AI</p>
        </div>
      </header>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-8 space-y-6">
          {messages.map((msg, idx) => (
            <div key={msg.id}>
              <MessageBubble
                message={msg}
                isLatestAiMsg={idx === messages.length - 1 && !sending && msg.source === "assistant"}
                onSendIntent={(txt, intent) => handleUserSend(txt, intent)}
                onSaveSelection={(type, text) => {
                  setWeakScoreDismissed(true);
                  if (type === "hook") onHookSelect(text);
                }}
                onEditScript={(scriptText) => setEditingScript(scriptText)}
                // Show regenerate button ONLY on the latest hook container
                onRegenerateHook={
                  msg.id === latestHookMsgId
                    ? () => handleUserSend("Regenerate hooks 🔄", "generate_hooks")
                    : undefined
                }
                hideRegenerateBtn={maxHooksReached}
              />

              {/* Weak Score / Improve Idea Action Strip */}
              {idx === 0 && msg.source === "assistant" && showWeakScoreActions && (
                <WeakScoreActions
                  onImprove={handleImproveClick}
                  onDismiss={() => setWeakScoreDismissed(true)}
                  loading={improveLoading}
                />
              )}
            </div>
          ))}

          {sending && <TypingIndicator />}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Input Bar */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-4 z-10">
        <div className="max-w-[700px] mx-auto">
          <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm">
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
              className="flex-1 bg-transparent px-3 py-2.5 outline-none resize-none disabled:opacity-50 text-sm text-slate-800 placeholder-slate-400 self-center"
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

      {/* ── Warning Modal (If user asks to generate hooks again) ── */}
      {warningMessage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold text-slate-900">Action Not Allowed</h3>
            <p className="text-[14px] text-slate-500 leading-relaxed">{warningMessage}</p>
            <button
              onClick={() => setWarningMessage(null)}
              className="w-full mt-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all active:scale-95"
            >
              Okay, got it
            </button>
          </div>
        </div>
      )}

      {/* ── Improve Idea Modal ── */}
      {improvedData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-900">Improved Idea</h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200">
                <span className="text-xs font-semibold text-orange-600">Score</span>
                <span className="text-sm font-bold text-orange-600">{improvedData.win_score}/10</span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">New Angle</p>
                <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-2xl">
                  <p className="text-[15px] text-slate-800 font-medium leading-relaxed">
                    {improvedData.improved_idea}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Why it works</p>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  {improvedData.why_it_works}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleKeepOld}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
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

      {/* ── Hook Replacement Confirmation Modal ── */}
      {confirmHook && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Replace Hook?</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                You have already selected a hook. Do you want to overwrite it with this new one?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmHook(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
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

      {/* ── Script Edit Modal ── */}
      {editingScript !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Edit Your Script</h3>
              <button
                onClick={() => setEditingScript(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 p-5 bg-white overflow-hidden">
              <textarea
                value={editingScript}
                onChange={(e) => setEditingScript(e.target.value)}
                className="w-full h-full resize-none outline-none text-[15px] text-slate-700 leading-relaxed bg-transparent"
                placeholder="Write your script here..."
              />
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setEditingScript(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScriptSave}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm active:scale-95 transition-all flex items-center gap-2"
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
    </div>
  );
}