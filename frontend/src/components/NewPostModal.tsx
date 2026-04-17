// frontend/src/components/NewPostModal.tsx
// Full New Post overlay. Uses useNewPost hook for all logic.
// On "done", navigates to /chat/:chatId instead of just closing.

import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNewPost } from "../hooks/useNewPost";
import type { Chat, Idea } from "../lib/ideasApi";

interface Props {
  onClose: () => void;
  onChatCreated?: (chat: Chat) => void;
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function IdeaCard({
  idea,
  onSelect,
  onToggleFavourite,
}: {
  idea: Idea;
  onSelect: (idea: Idea) => void;
  onToggleFavourite: (idea: Idea) => void;
}) {
  return (
    <div
      className="group relative bg-zinc-800 border border-zinc-700 hover:border-orange-500/50 rounded-xl p-4 transition-all duration-200 cursor-pointer"
      onClick={() => onSelect(idea)}
    >
      <p className="text-zinc-200 text-sm leading-relaxed pr-8">{idea.idea}</p>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavourite(idea); }}
        className={`absolute top-3 right-3 p-1 rounded-lg transition-all duration-150 ${
          idea.is_favourite
            ? "text-orange-400"
            : "text-zinc-600 hover:text-zinc-400"
        }`}
        aria-label={idea.is_favourite ? "Remove from favourites" : "Add to favourites"}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill={idea.is_favourite ? "currentColor" : "none"}
          stroke="currentColor" strokeWidth="2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>

      <p className="text-zinc-600 text-xs mt-2 group-hover:text-orange-400 transition-colors">
        Click to select →
      </p>
    </div>
  );
}

export default function NewPostModal({ onClose, onChatCreated }: Props) {
  const navigate = useNavigate();

  const {
    state,
    setInputText,
    submitUserIdea,
    handleGenerate,
    handleToggleFavourite,
    handleSelectIdea,
    handleBackFromConfirm,
    handleConfirm,
    reset,
  } = useNewPost((chat) => onChatCreated?.(chat));

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.view === "input") setTimeout(() => textareaRef.current?.focus(), 80);
  }, [state.view]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClose = () => { reset(); onClose(); };

  // Navigate to chat page when a chat is created
  const handleGoToChat = () => {
    if (!state.createdChat) return;
    reset();
    onClose();
    navigate(`/chat/${state.createdChat.id}`);
  };

  const headerTitle: Record<typeof state.view, string> = {
    input: "New Post",
    generated: "Choose an idea",
    confirming: "Confirm idea",
    done: "Ready to go!",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            {state.view === "confirming" && (
              <button
                type="button" onClick={handleBackFromConfirm}
                className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
              >←</button>
            )}
            <h2 className="text-white font-semibold text-base">{headerTitle[state.view]}</h2>
          </div>
          <button
            type="button" onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* ── View: input ─────────────────────────────────────────────── */}
          {state.view === "input" && (
            <>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2 block">
                  Write your idea
                </label>
                <textarea
                  ref={textareaRef}
                  value={state.inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && state.inputText.trim()) {
                      submitUserIdea();
                    }
                  }}
                  rows={3}
                  placeholder="e.g. A day-in-my-life reel showing my morning routine as a student..."
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-orange-500 rounded-xl px-4 py-3 text-zinc-200 text-sm placeholder-zinc-600 outline-none resize-none transition-colors duration-150"
                />
                <p className="text-zinc-600 text-xs mt-1">⌘ + Enter to save your idea</p>
              </div>

              {state.error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {state.error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button" onClick={submitUserIdea}
                  disabled={!state.inputText.trim() || state.saving || state.generating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {state.saving ? <><Spinner /> Saving…</> : "Save idea →"}
                </button>

                <button
                  type="button" onClick={handleGenerate}
                  disabled={state.generating || state.saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 ml-auto"
                >
                  {state.generating ? <><Spinner /> Generating…</> : <>✨ Generate Ideas</>}
                </button>
              </div>
            </>
          )}

          {/* ── View: generated ─────────────────────────────────────────── */}
          {state.view === "generated" && (
            <>
              <p className="text-zinc-500 text-xs">
                3 ideas tailored to your niche — click one to use it, ★ to favourite it.
              </p>
              <div className="space-y-3">
                {state.generatedIdeas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onSelect={handleSelectIdea}
                    onToggleFavourite={handleToggleFavourite}
                  />
                ))}
              </div>
              {state.error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {state.error}
                </p>
              )}
            </>
          )}

          {/* ── View: confirming ────────────────────────────────────────── */}
          {state.view === "confirming" && state.selectedIdea && (
            <>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                <p className="text-zinc-200 text-sm leading-relaxed">{state.selectedIdea.idea}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border ${
                  state.selectedIdea.source === "postra"
                    ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
                    : "text-zinc-400 bg-zinc-700 border-zinc-600"
                }`}>
                  {state.selectedIdea.source === "postra" ? "AI generated" : "Your idea"}
                </span>
              </div>

              <p className="text-zinc-500 text-sm">
                This will create a new post workflow from this idea. Ready to start?
              </p>

              {state.error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {state.error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button" onClick={handleBackFromConfirm}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-sm font-medium transition-all duration-150"
                >
                  ← Back
                </button>
                <button
                  type="button" onClick={handleConfirm}
                  disabled={state.confirming}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 shadow-lg shadow-orange-500/25 ml-auto"
                >
                  {state.confirming ? <><Spinner /> Creating…</> : "Confirm & Start →"}
                </button>
              </div>
            </>
          )}

          {/* ── View: done ──────────────────────────────────────────────── */}
          {state.view === "done" && state.createdChat && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Post workflow created!</h3>
                <p className="text-zinc-400 text-sm mt-1 max-w-xs mx-auto">
                  "{state.createdChat.title}"
                </p>
              </div>
              {/* ── CHANGED: was "Go to drafts →", now goes to /chat/:id ── */}
              <button
                type="button"
                onClick={handleGoToChat}
                className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-all duration-150 shadow-lg shadow-orange-500/25"
              >
                Start creating →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}