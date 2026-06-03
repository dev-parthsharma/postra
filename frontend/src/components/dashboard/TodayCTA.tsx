// frontend/src/components/dashboard/TodayCTA.tsx
// Refactored V2: Today's planning card (Includes 1-click active scheduled idea generators + randomized emotional mindset triggers).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TodayCTA as TodayCTAType } from "../../hooks/useDashboard";
import { generatePostForExistingIdea } from "../../lib/ideasApi"; // 🟢 1-Click generation call
import { Spinner } from "../Spinner";

interface TodayCTAProps {
  cta: TodayCTAType;
  loading: boolean;
  onOpenNewPost: () => void; // 🟢 Bypasses to open NewPostModal
}

// ── 🟢 randomized EMOTIONAL / MENTAL MINDS-CHECK ARRAYS ──
const MINDSET_PROMPTS = [
  {
    emoji: "☕",
    title: "Take a Deep Breath",
    text: "Burnout is real, Creator. If you don't feel like creating today, just take a break. The algorithm can wait, your peace of mind cannot.",
    btnText: "Quick Brain Dump 💡",
    action: "dump"
  },
  {
    emoji: "✨",
    title: "Consistency > Perfection",
    text: "Great scripts aren't rushed. If you don't have a structured idea ready, just write down a raw photo concept or a quick thought.",
    btnText: "Brain Dump an Idea 💡",
    action: "dump"
  },
  {
    emoji: "🌱",
    title: "Why did you start?",
    text: "Take 5 minutes today to look back at your very first post. Appreciate how far you've come. You're doing amazing!",
    btnText: "Save a Quick Idea 💡",
    action: "ideas"
  },
  {
    emoji: "🧠",
    title: "Feeling a Creative Block?",
    text: "Creative blocks are just your brain's way of saying it's time to consume, not just produce. Read, watch, and let us suggest fresh ideas.",
    btnText: "Get Niche Ideas 💡",
    action: "ideas"
  }
];

export default function TodayCTA({ cta, loading, onOpenNewPost }: TodayCTAProps) {
  const navigate = useNavigate();
  const [mindset, setMindset] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  // 🟢 Load randomized emotional message on mount
  useEffect(() => {
    if (cta.type === "mindset") {
      const randomPrompt = MINDSET_PROMPTS[Math.floor(Math.random() * MINDSET_PROMPTS.length)];
      setMindset(randomPrompt);
    }
  }, [cta.type]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-56 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-8 w-24 bg-slate-100 rounded-xl animate-pulse flex-shrink-0" />
      </div>
    );
  }

  // ── 🟢 STATE 1: TODAY'S SCHEDULED PLANNER IDEA (1-Click Generation) ──
  if (cta.type === "scheduled_idea") {
    const handleGenerateNow = async () => {
      setGenerating(true);
      try {
        const res = await generatePostForExistingIdea(cta.idea.id);
        navigate(`/chat/${res.id}`); // Redirect direct to Editor Preview page!
      } catch (err) {
        alert("Failed to auto-generate post. Please try again.");
        setGenerating(false);
      }
    };

    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-zinc-900/40 dark:to-zinc-800/40 border border-amber-100 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📅</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide mb-0.5">Post Scheduled for Today</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">"{cta.idea.idea}"</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">This is your planned content for today. Ready to build it?</p>
        </div>
        <button
          onClick={handleGenerateNow}
          disabled={generating}
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-150 whitespace-nowrap flex items-center gap-1.5"
        >
          {generating ? <Spinner size={12} /> : "Generate Post ⚡"}
        </button>
      </div>
    );
  }

  // ── 🟢 STATE 2: ACTIVE UNFINISHED DRAFT POST ──
  if (cta.type === "draft") {
    const title = cta.draft.hook
      ? cta.draft.hook
      : cta.draft.idea ?? "Untitled draft";

    const destination = `/chat/${cta.draft.id}`;

    return (
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-zinc-900/40 dark:to-zinc-800/40 border border-indigo-100 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📝</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-0.5">Post for today</p>
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 truncate">"{title}"</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">You started this — finish it and post today.</p>
        </div>
        <button
          onClick={() => navigate(destination)}
          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-150 whitespace-nowrap"
        >
          Finish this →
        </button>
      </div>
    );
  }

  // ── 🟢 STATE 3: UNSCHEDULED PLANNED IDEA ──
  if (cta.type === "idea") {
    const ideaText = cta.idea.idea ?? "Saved idea";

    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-zinc-900/40 dark:to-zinc-800/40 border border-amber-100 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center flex-shrink-0">
          <span className="text-lg">💡</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide mb-0.5">Post for today</p>
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 truncate">"{ideaText}"</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Turn this idea into a post — you saved it for a reason.</p>
        </div>
        <button
          onClick={() => navigate("/ideas")}
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-150 whitespace-nowrap"
        >
          Write it →
        </button>
      </div>
    );
  }

  // ── 🟢 STATE 4: randomized EMOTIONAL / MENTAL MINDS-CHECK (Nothing Scheduled) ──
  if (cta.type === "mindset" && mindset) {
    const handleAction = () => {
      if (mindset.action === "ideas") {
        navigate("/ideas");
      } else {
        onOpenNewPost(); // Trigger NewPostModal directly
      }
    };

    return (
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-zinc-900/40 dark:to-zinc-800/40 border border-teal-100/70 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm animate-in fade-in duration-300">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center flex-shrink-0 text-lg">
          {mindset.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-0.5">{mindset.title}</p>
          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-200 leading-relaxed pr-2">
            {mindset.text}
          </p>
        </div>
        <button
          onClick={handleAction}
          className="flex-shrink-0 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all duration-150 whitespace-nowrap"
        >
          {mindset.btnText}
        </button>
      </div>
    );
  }

  return null;
}