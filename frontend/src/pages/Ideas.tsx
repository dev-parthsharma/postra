// frontend/src/pages/Ideas.tsx
// Shows all ideas. Highlights recommended ideas with metadata.
// Features: cycling loading messages, recommended card, 2 alternative cards,
// win_score, why_it_works, fallback indicator, dedup (via backend session cache),
// improve idea feature (Gemini → Groq fallback).

import { useEffect, useState, useCallback, useRef } from "react";
import {
  listIdeas,
  saveUserIdea,
  toggleFavourite,
  confirmIdea,
  deleteIdea,
  generateIdeas,
  improveIdea,
  ApiError,
  type Idea,
  type IdeaWithMeta,
  type GeneratedIdeasResult,
} from "../lib/ideasApi";
import { useNavigate } from "react-router-dom";
import { classifyIdea } from "../utils/ideaValidator";

// ── Loading messages that cycle during generation ─────────────────────────────

const LOADING_MESSAGES = [
  "Generating ideas...",
  "Finding something strong for your niche...",
  "Checking what fits best...",
  "Almost there...",
  "Putting finishing touches...",
];

const IMPROVE_LOADING_MESSAGES = [
  "Improving your idea...",
  "Making it more specific...",
  "Boosting viral potential...",
  "Almost done...",
];

function useLoadingMessage(active: boolean, messages: string[]): string {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setIndex(0);
      intervalRef.current = setInterval(() => {
        setIndex((i) => (i + 1) % messages.length);
      }, 1800);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, messages.length]);

  return messages[index];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ small = false }: { small?: boolean }) {
  return (
    <svg className={`animate-spin ${small ? "w-3 h-3" : "w-4 h-4"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function WinScore({ score }: { score: number | null | undefined }) {
  if (!score) return null;
  const color =
    score >= 8 ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20" :
    score >= 6 ? "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20" :
                 "text-slate-500 bg-slate-100 border-slate-200 dark:text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      {score}/10
    </span>
  );
}

// ── Improve Idea Modal ────────────────────────────────────────────────────────

interface ImproveModalProps {
  idea: Idea;
  onClose: () => void;
  onApply: (improvedText: string, whyItWorks: string, winScore: number) => void;
}

function ImproveModal({ idea, onClose, onApply }: ImproveModalProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ improved_idea: string; why_it_works: string; win_score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const improveLoadingMsg = useLoadingMessage(status === "loading", IMPROVE_LOADING_MESSAGES);

  const handleImprove = async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await improveIdea(idea.id, idea.idea);
      setResult(res);
      setStatus("done");
    } catch (e: unknown) {
      setError((e as Error).message || "AI is temporarily unavailable. Please try again later.");
      setStatus("error");
    }
  };

  // Auto-start improve on mount
  useEffect(() => {
    handleImprove();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Improve Idea</h3>
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

        <div className="p-5 space-y-4">
          {/* Original */}
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Original</p>
            <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3">
              <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">{idea.idea}</p>
            </div>
          </div>

          {/* Loading state */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 flex items-center justify-center">
                <Spinner />
              </div>
              <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">{improveLoadingMsg}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-orange-400 dark:bg-orange-500 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <span className="text-base flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-red-600 dark:text-red-400 text-sm font-semibold">AI Unavailable</p>
                  <p className="text-slate-500 dark:text-zinc-500 text-xs mt-0.5">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleImprove}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium transition-all"
              >
                ↺ Try Again
              </button>
            </div>
          )}

          {/* Done state */}
          {status === "done" && result && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wider mb-2">✨ Improved Version</p>
                <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-xl p-3.5">
                  <p className="text-slate-800 dark:text-zinc-100 text-sm font-medium leading-relaxed">{result.improved_idea}</p>
                  {result.why_it_works && (
                    <div className="flex items-start gap-1.5 mt-2.5">
                      <span className="text-orange-500 text-[10px] mt-0.5 flex-shrink-0">💡</span>
                      <p className="text-slate-500 dark:text-zinc-400 text-xs italic leading-relaxed">{result.why_it_works}</p>
                    </div>
                  )}
                  <div className="mt-2">
                    <WinScore score={result.win_score} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleImprove}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-medium transition-all"
                >
                  ↺ Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => onApply(result.improved_idea, result.why_it_works, result.win_score)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-all shadow-md shadow-orange-500/20"
                >
                  Use Improved Version →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton for the generated section ────────────────────────────────

function GeneratingSkeleton({ message }: { message: string }) {
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-slate-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider">
          ✨ Fresh ideas for you
        </h3>
        <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500">
          <Spinner small />
          {message}
        </span>
      </div>

      {/* Recommended skeleton */}
      <div>
        <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide mb-2">
          🔥 Recommended for you
        </p>
        <div className="relative bg-orange-50 dark:bg-gradient-to-br dark:from-orange-500/5 dark:to-zinc-900 border border-orange-200 dark:border-orange-500/15 rounded-2xl p-5 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-16 bg-orange-100 dark:bg-zinc-800 rounded-full" />
            <div className="h-4 w-12 bg-orange-100 dark:bg-zinc-800 rounded-full" />
          </div>
          <div className="h-4 bg-orange-100 dark:bg-zinc-800 rounded w-full mb-2" />
          <div className="h-4 bg-orange-100 dark:bg-zinc-800 rounded w-5/6 mb-4" />
          <div className="h-3 bg-orange-50 dark:bg-zinc-800/60 rounded w-4/6 mb-5" />
          <div className="h-8 bg-orange-100 dark:bg-zinc-800 rounded-xl w-28" />
        </div>
      </div>

      {/* Alternatives skeleton */}
      <div>
        <p className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
          👇 Or try these
        </p>
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="bg-slate-100 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/60 rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-4/5 mb-3" />
              <div className="h-3 bg-slate-100 dark:bg-zinc-700/60 rounded w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Generated Ideas Section ───────────────────────────────────────────────────

interface GeneratedSectionProps {
  result: GeneratedIdeasResult;
  onSelect: (idea: Idea) => void;
  onToggleFavourite: (idea: Idea) => void;
  onImprove: (idea: Idea) => void;
  onRegenerate: () => void;
  generating: boolean;
  loadingMessage: string;
}

function GeneratedSection({
  result,
  onSelect,
  onToggleFavourite,
  onImprove,
  onRegenerate,
  generating,
  loadingMessage,
}: GeneratedSectionProps) {
  if (generating) {
    return <GeneratingSkeleton message={loadingMessage} />;
  }

  const rec  = result.recommended;
  const alts = result.alternatives;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-slate-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider">
            ✨ Fresh ideas for you
          </h3>
          {result._fallback && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
              evergreen picks
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={generating}
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
        >
          ↺ Regenerate
        </button>
      </div>

      {/* Recommended */}
      <div>
        <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide mb-2">
          🔥 Recommended for you
        </p>
        <RecommendedIdeaCard
          idea={rec}
          onSelect={onSelect}
          onToggleFavourite={onToggleFavourite}
          onImprove={onImprove}
        />
      </div>

      {/* Alternatives */}
      <div>
        <p className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
          👇 Or try these
        </p>
        <div className="space-y-2">
          {alts.map((idea) => (
            <AlternativeIdeaCard
              key={idea.id}
              idea={idea}
              onSelect={onSelect}
              onToggleFavourite={onToggleFavourite}
              onImprove={onImprove}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RecommendedIdeaCard({
  idea,
  onSelect,
  onToggleFavourite,
  onImprove,
}: {
  idea: IdeaWithMeta;
  onSelect: (idea: Idea) => void;
  onToggleFavourite: (idea: Idea) => void;
  onImprove: (idea: Idea) => void;
}) {
  const [starting, setStarting] = useState(false);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStarting(true);
    await onSelect(idea);
    setStarting(false);
  };

  return (
    <div className="relative bg-gradient-to-br from-orange-50 to-amber-50/50 dark:bg-none dark:bg-zinc-800/80 border border-orange-200 dark:border-orange-500/30 rounded-2xl p-5 hover:border-orange-300 dark:hover:border-orange-500/50 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Top pick
          </span>
          <WinScore score={idea.win_score} />
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(idea); }}
          className={`flex-shrink-0 transition-colors ${
            idea.is_favourite ? "text-orange-500" : "text-slate-300 dark:text-zinc-700 hover:text-slate-500 dark:hover:text-zinc-500"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={idea.is_favourite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      </div>

      <p className="text-slate-800 dark:text-white text-sm font-medium leading-relaxed mb-3">{idea.idea}</p>

      {idea.why_it_works && (
        <div className="flex items-start gap-1.5 mb-4">
          <span className="text-orange-500 text-[10px] mt-0.5 flex-shrink-0">💡</span>
          <p className="text-slate-500 dark:text-zinc-200 text-xs italic leading-relaxed">{idea.why_it_works}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {!idea.in_progress ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-md shadow-orange-500/20"
          >
            {starting ? <Spinner small /> : null}
            {starting ? "Starting…" : "Start Chat →"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            {starting ? <Spinner small /> : null}
            {starting ? "Opening…" : "Continue →"}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onImprove(idea); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-orange-300 dark:hover:border-orange-500/40 text-slate-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 text-xs font-medium transition-all"
        >
          ✨ Improve
        </button>
        <span className="text-slate-400 dark:text-zinc-600 text-xs ml-auto">
          {idea.source === "postra" ? "✨ AI generated" : "✍️ Your idea"}
        </span>
      </div>
    </div>
  );
}

function AlternativeIdeaCard({
  idea,
  onSelect,
  onToggleFavourite,
  onImprove,
}: {
  idea: IdeaWithMeta;
  onSelect: (idea: Idea) => void;
  onToggleFavourite: (idea: Idea) => void;
  onImprove: (idea: Idea) => void;
}) {
  const [starting, setStarting] = useState(false);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStarting(true);
    await onSelect(idea);
    setStarting(false);
  };

  return (
    <div className="bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 hover:border-slate-300 dark:hover:border-zinc-600 transition-all group shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-slate-800 dark:text-zinc-200 text-sm leading-relaxed">{idea.idea}</p>
          {idea.why_it_works && (
            <p className="text-slate-400 dark:text-zinc-500 text-xs italic mt-1.5 leading-relaxed">{idea.why_it_works}</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(idea); }}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            idea.is_favourite ? "text-orange-500" : "text-slate-300 dark:text-zinc-700 hover:text-slate-400 dark:hover:text-zinc-500"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={idea.is_favourite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between mt-3">
        <WinScore score={idea.win_score} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onImprove(idea); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-700 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-slate-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 text-xs font-medium transition-all border border-slate-200 dark:border-zinc-600 hover:border-orange-200 dark:hover:border-orange-500/30"
          >
            ✨ Improve
          </button>
          {!idea.in_progress ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-zinc-700 hover:bg-slate-700 dark:hover:bg-zinc-600 text-white dark:text-zinc-200 text-xs font-medium transition-all disabled:opacity-50"
            >
              {starting ? <Spinner small /> : null}
              {starting ? "Starting…" : "Use this →"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
            >
              {starting ? <Spinner small /> : null}
              {starting ? "Opening…" : "Continue →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Saved Idea Row ────────────────────────────────────────────────────────────

function IdeaRow({
  idea,
  highlighted,
  onToggleFavourite,
  onStartChat,
  onDelete,
  onImprove,
}: {
  idea: Idea;
  highlighted: boolean;
  onToggleFavourite: (idea: Idea) => void;
  onStartChat: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
  onImprove: (idea: Idea) => void;
}) {
  const [starting, setStarting] = useState(false);

  const handleStartChat = async () => {
    setStarting(true);
    await onStartChat(idea);
    setStarting(false);
  };

  return (
    <div className={`relative bg-white dark:bg-zinc-900 border rounded-xl p-4 transition-all duration-200 shadow-sm ${
      highlighted
        ? "border-orange-200 dark:border-orange-500/30 bg-orange-50/30 dark:bg-orange-500/5"
        : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
    }`}>
      <div className="flex items-start gap-3">
        {/* Favourite */}
        <button
          type="button"
          onClick={() => onToggleFavourite(idea)}
          className={`mt-0.5 flex-shrink-0 transition-colors duration-150 ${
            idea.is_favourite ? "text-orange-500" : "text-slate-300 dark:text-zinc-700 hover:text-slate-400 dark:hover:text-zinc-500"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={idea.is_favourite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Score + source badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded border ${
              idea.source === "postra"
                ? "text-orange-500 dark:text-orange-400/70 bg-orange-50 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/15"
                : "text-slate-500 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
            }`}>
              {idea.source === "postra" ? "✨ AI" : "✍️ You"}
            </span>

            {idea.win_score != null && idea.win_score > 0 && (
              <WinScore score={idea.win_score} />
            )}

            {!!idea.in_progress && (
              <span className="text-xs px-1.5 py-0.5 rounded border text-blue-600 dark:text-blue-400/70 bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/15">
                ⏳ In progress
              </span>
            )}
          </div>

          {/* Idea text */}
          <p className="text-slate-800 dark:text-zinc-200 text-sm leading-relaxed">{idea.idea}</p>

          {/* Why it works */}
          {idea.why_it_works && (
            <div className="flex items-start gap-1.5 mt-1.5">
              <span className="text-orange-500 text-[10px] mt-0.5 flex-shrink-0">💡</span>
              <p className="text-slate-400 dark:text-zinc-500 text-xs italic leading-relaxed">{idea.why_it_works}</p>
            </div>
          )}

          {/* Date + Improve button */}
          <div className="flex items-center gap-3 mt-2">
            <p className="text-slate-400 dark:text-zinc-600 text-xs">
              {new Date(idea.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
            <button
              type="button"
              onClick={() => onImprove(idea)}
              className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors font-medium"
            >
              ✨ Improve this idea
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {idea.source === "user" && (
            <button
              type="button"
              onClick={() => onDelete(idea)}
              className="text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-150"
              title="Delete idea"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {!idea.in_progress ? (
            <button
              type="button"
              onClick={handleStartChat}
              disabled={starting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-all duration-150 disabled:opacity-50 shadow-sm shadow-orange-500/20"
            >
              {starting ? <Spinner small /> : null}
              {starting ? "Starting…" : "Start Chat →"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartChat}
              disabled={starting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all duration-150 disabled:opacity-50"
            >
              {starting ? <Spinner small /> : null}
              {starting ? "Opening…" : "Continue →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveText, setSaveText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGibberish, setIsGibberish] = useState(false);
  const [confusedWarning, setConfusedWarning] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedIdeasResult | null>(null);

  // Improve idea modal
  const [improveTarget, setImproveTarget] = useState<Idea | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const generateRequestId = useRef(0);
  const loadingMessage = useLoadingMessage(generating, LOADING_MESSAGES);
  const fetchIdeas = useCallback(async () => {
    try {
      const data = await listIdeas();
      setIdeas(data);
    } catch (e: unknown) {
      setFetchError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  // ── Generate structured ideas ─────────────────────────────────────────────

const handleGenerate = async () => {
  // Cancel any in-flight request before firing a new one
  generateAbortRef.current?.abort();
  const controller = new AbortController();
  generateAbortRef.current = controller;

  setGenerating(true);
  setGenerateError(null);
  try {
    const result = await generateIdeas(controller.signal);
    setGeneratedResult(result);
    setIdeas((prev) => {
      const newIds = new Set([result.recommended.id, ...result.alternatives.map((a) => a.id)]);
      const filtered = prev.filter((i) => !newIds.has(i.id));
      return [result.recommended, ...result.alternatives, ...filtered];
    });
  } catch (e: unknown) {
    if ((e as Error).name === "AbortError") return; // cancelled — ignore silently
    setGenerateError((e as Error).message);
  } finally {
    setGenerating(false);
  }
};

  // ── Save user idea ────────────────────────────────────────────────────────

  const handleSave = async () => {
    const text = saveText.trim();
    if (!text) return;

    setSaveError(null);
    setIsGibberish(false);
    setConfusedWarning(null);

    if (classifyIdea(text) === "gibberish") {
      setIsGibberish(true);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveUserIdea(text);
      setIdeas((prev) => [saved, ...prev]);
      setSaveText("");
      if (saved.warning && saved.message) {
        setConfusedWarning(saved.message);
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.type === "INVALID") {
          setIsGibberish(true);
        } else {
          setSaveError(e.message);
        }
      } else {
        setSaveError((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavourite = async (idea: Idea) => {
    const next = !idea.is_favourite;
    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, is_favourite: next } : i));
    if (generatedResult) {
      setGeneratedResult((r) => {
        if (!r) return r;
        return {
          ...r,
          recommended: r.recommended.id === idea.id ? { ...r.recommended, is_favourite: next } : r.recommended,
          alternatives: r.alternatives.map((a) => a.id === idea.id ? { ...a, is_favourite: next } : a) as [IdeaWithMeta, IdeaWithMeta],
        };
      });
    }
    try {
      await toggleFavourite(idea.id, next);
    } catch {
      setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, is_favourite: !next } : i));
    }
  };

  const handleDelete = async (idea: Idea) => {
    if (idea.in_progress) {
      const confirmed = window.confirm(
        "This idea has an active chat. Deleting it will also delete the chat and all its messages. Continue?"
      );
      if (!confirmed) return;
    }
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    if (generatedResult) {
      if (
        generatedResult.recommended.id === idea.id ||
        generatedResult.alternatives.some((a) => a.id === idea.id)
      ) {
        setGeneratedResult(null);
      }
    }
    try {
      await deleteIdea(idea.id);
    } catch (e: unknown) {
      setIdeas((prev) => [idea, ...prev]);
      console.error("Failed to delete idea:", e);
    }
  };

  const handleStartChat = async (idea: Idea) => {
    try {
      if (idea.in_progress && idea.chat_id) {
        navigate(`/chat/${idea.chat_id}`);
      } else {
        const chat = await confirmIdea(idea.id, idea.idea);
        navigate(`/chat/${chat.id}`);
      }
    } catch (e: unknown) {
      console.error("Failed to start/continue chat:", e);
    }
  };

  // ── Improve idea ──────────────────────────────────────────────────────────

  const handleImprove = (idea: Idea) => {
    setImproveTarget(idea);
  };

  const handleApplyImprovement = (improvedText: string, whyItWorks: string, winScore: number) => {
    if (!improveTarget) return;
    // Update the idea in-place locally
    setIdeas((prev) => prev.map((i) =>
      i.id === improveTarget.id
        ? { ...i, idea: improvedText, why_it_works: whyItWorks, win_score: winScore }
        : i
    ));
    if (generatedResult) {
      setGeneratedResult((r) => {
        if (!r) return r;
        return {
          ...r,
          recommended: r.recommended.id === improveTarget.id
            ? { ...r.recommended, idea: improvedText, why_it_works: whyItWorks, win_score: winScore }
            : r.recommended,
          alternatives: r.alternatives.map((a) =>
            a.id === improveTarget.id
              ? { ...a, idea: improvedText, why_it_works: whyItWorks, win_score: winScore }
              : a
          ) as [IdeaWithMeta, IdeaWithMeta],
        };
      });
    }
    setImproveTarget(null);
  };

  const isHighlighted = (idea: Idea) => idea.source === "user" || idea.is_favourite;
  const highlighted = ideas.filter(isHighlighted);
  const generatedIds = generatedResult
    ? new Set([generatedResult.recommended.id, ...generatedResult.alternatives.map((a) => a.id)])
    : new Set<string>();
  const rest = ideas.filter((i) => !isHighlighted(i) && !generatedIds.has(i.id));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header + Generate CTA ─────────────────────────────────────────── */}
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 dark:text-white font-semibold text-base">Ideas</h2>
          <p className="text-slate-500 dark:text-zinc-500 text-sm mt-0.5">Generate fresh ideas or save your own.</p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 shadow-lg shadow-orange-500/20"
        >
          {generating ? <><Spinner /> {loadingMessage}</> : <>✨ Generate Ideas</>}
        </button>
      </section>

      {/* Generate error */}
      {generateError && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <span className="text-base leading-none flex-shrink-0">⚠️</span>
          <p className="text-red-600 dark:text-red-400 text-sm">{generateError}</p>
        </div>
      )}

      {/* ── Generated Ideas Section (or skeleton while loading) ───────────── */}
      {(generatedResult || generating) && (
        <GeneratedSection
          result={generatedResult ?? { recommended: {} as IdeaWithMeta, alternatives: [{} as IdeaWithMeta, {} as IdeaWithMeta] }}
          onSelect={handleStartChat}
          onToggleFavourite={handleToggleFavourite}
          onImprove={handleImprove}
          onRegenerate={handleGenerate}
          generating={generating}
          loadingMessage={loadingMessage}
        />
      )}

      {/* Divider when both sections shown */}
      {(generatedResult || generating) && (highlighted.length > 0 || rest.length > 0) && (
        <div className="border-t border-slate-200 dark:border-zinc-800" />
      )}

      {/* ── Save idea for later ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-slate-900 dark:text-white font-semibold text-base mb-1">Save idea for later</h2>
        <p className="text-slate-500 dark:text-zinc-500 text-sm mb-4">
          Capture a quick idea now — no AI, just save it before it slips away.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={saveText}
            onChange={(e) => {
              setSaveText(e.target.value);
              setSaveError(null);
              setIsGibberish(false);
              setConfusedWarning(null);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && saveText.trim()) handleSave(); }}
            placeholder="Write your idea here…"
            className={`flex-1 bg-white dark:bg-zinc-800 border rounded-xl px-4 py-2.5 text-slate-800 dark:text-zinc-200 text-sm placeholder-slate-400 dark:placeholder-zinc-600 outline-none transition-colors duration-150 ${
              isGibberish
                ? "border-red-400 dark:border-red-500/60 focus:border-red-500"
                : "border-slate-300 dark:border-zinc-700 focus:border-orange-500"
            }`}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!saveText.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500 text-slate-700 dark:text-zinc-300 text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? <Spinner small /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {isGibberish && (
          <div className="mt-3 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <span className="text-base leading-none flex-shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-red-600 dark:text-red-400 text-sm font-semibold">Invalid text</p>
              <p className="text-slate-500 dark:text-zinc-500 text-xs mt-0.5">
                This doesn't look like a real idea. Write something meaningful, or let AI generate ideas for you.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsGibberish(false);
                  setSaveText("");
                  handleGenerate();
                }}
                className="mt-2 text-xs font-semibold text-orange-500 hover:text-orange-400 transition-colors"
              >
                ✨ Generate ideas instead →
              </button>
            </div>
          </div>
        )}

        {confusedWarning && (
          <div className="mt-3 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <span className="text-base leading-none flex-shrink-0 mt-0.5">🤔</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-600 dark:text-amber-400 text-sm font-semibold">Idea saved, but it's a bit vague</p>
              <p className="text-slate-500 dark:text-zinc-500 text-xs mt-0.5">{confusedWarning}</p>
              <button type="button" onClick={() => setConfusedWarning(null)} className="mt-2 text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {saveError && (
          <p className="text-red-500 text-xs mt-2">{saveError}</p>
        )}
      </section>

      {/* ── Saved Ideas List ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 dark:text-zinc-600">
          <Spinner /> <span className="ml-2 text-sm">Loading ideas…</span>
        </div>
      ) : fetchError ? (
        <p className="text-red-500 text-sm">{fetchError}</p>
      ) : ideas.length === 0 && !generatedResult && !generating ? (
        <div className="text-center py-12">
          <p className="text-slate-400 dark:text-zinc-600 text-sm">No ideas yet. Generate some or save one above.</p>
        </div>
      ) : (
        <>
          {highlighted.length > 0 && (
            <section>
              <h3 className="text-slate-400 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                ★ Your ideas &amp; favourites
              </h3>
              <div className="space-y-2">
                {highlighted.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    highlighted={true}
                    onToggleFavourite={handleToggleFavourite}
                    onStartChat={handleStartChat}
                    onDelete={handleDelete}
                    onImprove={handleImprove}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h3 className="text-slate-400 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                All generated ideas
              </h3>
              <div className="space-y-2">
                {rest.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    highlighted={false}
                    onToggleFavourite={handleToggleFavourite}
                    onStartChat={handleStartChat}
                    onDelete={handleDelete}
                    onImprove={handleImprove}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Improve Idea Modal */}
      {improveTarget && (
        <ImproveModal
          idea={improveTarget}
          onClose={() => setImproveTarget(null)}
          onApply={handleApplyImprovement}
        />
      )}
    </div>
  );
}