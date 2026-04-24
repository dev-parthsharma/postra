// src/components/NewPostModal.tsx
// Modal triggered from Dashboard's "Generate Idea" button.
// Mirrors the loading-message cycling behaviour of the Ideas page.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  generateIdeas,
  confirmIdea,
  type Chat,
  type GeneratedIdeasResult,
  type IdeaWithMeta,
  type Idea,
} from "../lib/ideasApi";

// ── Loading messages (same set as Ideas page) ─────────────────────────────────
const LOADING_MESSAGES = [
  "Generating ideas...",
  "Finding something strong for your niche...",
  "Checking what fits best...",
  "Almost there...",
  "Putting finishing touches...",
];

function useLoadingMessage(active: boolean): string {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setIndex(0);
      intervalRef.current = setInterval(() => {
        setIndex((i) => (i + 1) % LOADING_MESSAGES.length);
      }, 1800);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  return LOADING_MESSAGES[index];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={`animate-spin ${small ? "w-3.5 h-3.5" : "w-5 h-5"}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function WinScore({ score }: { score: number | null | undefined }) {
  if (!score) return null;
  const color =
    score >= 8
      ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
      : score >= 6
      ? "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20"
      : "text-slate-500 bg-slate-100 border-slate-200 dark:text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      {score}/10
    </span>
  );
}

// ── Skeleton shown while generating ──────────────────────────────────────────

function GeneratingSkeleton({ message }: { message: string }) {
  return (
    <div className="space-y-4 p-5">
      {/* Status row */}
      <div className="flex items-center justify-center gap-2 py-2">
        <Spinner />
        <span className="text-sm text-slate-500 dark:text-zinc-400 font-medium">
          {message}
        </span>
      </div>

      {/* Animated dots */}
      <div className="flex justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-orange-400 dark:bg-orange-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>

      {/* Recommended skeleton */}
      <div className="rounded-2xl border border-orange-200 dark:border-orange-500/15 bg-orange-50 dark:bg-orange-500/5 p-4 animate-pulse space-y-2">
        <div className="flex gap-2 mb-3">
          <div className="h-4 w-16 bg-orange-100 dark:bg-zinc-800 rounded-full" />
          <div className="h-4 w-10 bg-orange-100 dark:bg-zinc-800 rounded-full" />
        </div>
        <div className="h-3.5 bg-orange-100 dark:bg-zinc-800 rounded w-full" />
        <div className="h-3.5 bg-orange-100 dark:bg-zinc-800 rounded w-5/6" />
        <div className="h-3 bg-orange-50 dark:bg-zinc-800/60 rounded w-4/6 mt-1" />
        <div className="h-8 bg-orange-100 dark:bg-zinc-800 rounded-xl w-28 mt-3" />
      </div>

      {/* Alternative skeletons */}
      {[0, 1].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-slate-100/50 dark:bg-zinc-800/40 p-4 animate-pulse space-y-2"
        >
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-4/5" />
          <div className="h-3 bg-slate-100 dark:bg-zinc-700/60 rounded w-3/5" />
        </div>
      ))}
    </div>
  );
}

// ── Idea card (recommended) ───────────────────────────────────────────────────

function RecommendedCard({
  idea,
  onUse,
  starting,
}: {
  idea: IdeaWithMeta;
  onUse: (idea: IdeaWithMeta) => void;
  starting: boolean;
}) {
  return (
    <div className="relative bg-gradient-to-br from-orange-50 to-amber-50/50 dark:bg-none dark:bg-zinc-800/80 border border-orange-200 dark:border-orange-500/30 rounded-2xl p-4 transition-all">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
          🔥 Top pick
        </span>
        <WinScore score={idea.win_score} />
      </div>

      <p className="text-slate-800 dark:text-white text-sm font-medium leading-relaxed mb-2">
        {idea.idea}
      </p>

      {idea.why_it_works && (
        <div className="flex items-start gap-1.5 mb-3">
          <span className="text-orange-500 text-[10px] mt-0.5 flex-shrink-0">💡</span>
          <p className="text-slate-500 dark:text-zinc-200 text-xs italic leading-relaxed">
            {idea.why_it_works}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onUse(idea)}
        disabled={starting}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-md shadow-orange-500/20"
      >
        {starting ? <Spinner small /> : null}
        {starting ? "Starting…" : "Start Chat →"}
      </button>
    </div>
  );
}

// ── Alternative card ──────────────────────────────────────────────────────────

function AlternativeCard({
  idea,
  onUse,
  starting,
}: {
  idea: IdeaWithMeta;
  onUse: (idea: IdeaWithMeta) => void;
  starting: boolean;
}) {
  return (
    <div className="bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 transition-all shadow-sm">
      <p className="text-slate-800 dark:text-zinc-200 text-sm leading-relaxed mb-1">
        {idea.idea}
      </p>
      {idea.why_it_works && (
        <p className="text-slate-400 dark:text-zinc-500 text-xs italic mb-2 leading-relaxed">
          {idea.why_it_works}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <WinScore score={idea.win_score} />
        <button
          type="button"
          onClick={() => onUse(idea)}
          disabled={starting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-zinc-700 hover:bg-slate-700 dark:hover:bg-zinc-600 text-white dark:text-zinc-200 text-xs font-medium transition-all disabled:opacity-50"
        >
          {starting ? <Spinner small /> : null}
          {starting ? "Starting…" : "Use this →"}
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface NewPostModalProps {
  onClose: () => void;
  onChatCreated: (chat: Chat) => void;
}

type ModalState = "idle" | "generating" | "done" | "error";

export default function NewPostModal({ onClose, onChatCreated }: NewPostModalProps) {
  const navigate = useNavigate();

  const [state, setState]           = useState<ModalState>("idle");
  const [result, setResult]         = useState<GeneratedIdeasResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadingMessage = useLoadingMessage(state === "generating");

  // Holds the AbortController for the current in-flight generate request.
  // Strict Mode mounts twice in dev — the cleanup cancels the first call
  // before the second fires, so only one HTTP request reaches the backend.
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("generating");
    setError(null);
    setResult(null);
    try {
      const res = await generateIdeas(controller.signal);
      setResult(res);
      setState("done");
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return; // cancelled — do nothing
      setError((e as Error).message || "Failed to generate ideas. Please try again.");
      setState("error");
    }
  };

  // Auto-generate on mount. Cleanup aborts the request if the component
  // unmounts mid-flight (e.g. Strict Mode double-mount in development).
  useEffect(() => {
    handleGenerate();
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleUse = async (idea: Idea) => {
    setStartingId(idea.id);
    try {
      const chat = await confirmIdea(idea.id, idea.idea);
      onChatCreated(chat);
    } catch (e: unknown) {
      console.error("Failed to start chat:", e);
      setStartingId(null);
    }
  };

  const handleGoToIdeas = () => {
    onClose();
    navigate("/ideas");
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isStarting = startingId !== null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm">
              {state === "generating"
                ? "Generating Ideas"
                : state === "done"
                ? "Fresh Ideas for You"
                : "Generate Ideas"}
            </h3>
            {result?._fallback && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                evergreen picks
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1">

          {/* Generating — skeleton + cycling text */}
          {state === "generating" && (
            <GeneratingSkeleton message={loadingMessage} />
          )}

          {/* Error */}
          {state === "error" && (
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <span className="text-base flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-red-600 dark:text-red-400 text-sm font-semibold">
                    Something went wrong
                  </p>
                  <p className="text-slate-500 dark:text-zinc-500 text-xs mt-0.5">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-all"
              >
                ↺ Try Again
              </button>
            </div>
          )}

          {/* Done — show ideas */}
          {state === "done" && result && (
            <div className="p-5 space-y-3">
              {/* Recommended */}
              <div>
                <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide mb-2">
                  Recommended
                </p>
                <RecommendedCard
                  idea={result.recommended}
                  onUse={handleUse}
                  starting={isStarting && startingId === result.recommended.id}
                />
              </div>

              {/* Alternatives */}
              <div>
                <p className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                  Or try these
                </p>
                <div className="space-y-2">
                  {result.alternatives.map((alt) => (
                    <AlternativeCard
                      key={alt.id}
                      idea={alt}
                      onUse={handleUse}
                      starting={isStarting && startingId === alt.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {(state === "done" || state === "error") && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
            {state === "done" && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={state !== "done"}
                className="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                ↺ Regenerate
              </button>
            )}
            {state === "error" && <span />}
            <button
              type="button"
              onClick={handleGoToIdeas}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium transition-colors"
            >
              See all ideas →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}