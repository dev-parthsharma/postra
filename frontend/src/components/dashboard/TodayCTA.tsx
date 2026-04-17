// frontend/src/components/dashboard/TodayCTA.tsx
import { useNavigate } from "react-router-dom";
import type { TodayCTA as TodayCTAType } from "../../hooks/useDashboard";

interface TodayCTAProps {
  cta: TodayCTAType;
  loading: boolean;
}

export default function TodayCTA({ cta, loading }: TodayCTAProps) {
  const navigate = useNavigate();

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

  if (cta.type === "none") return null;

  if (cta.type === "draft") {
    const title = cta.draft.hook
      ? cta.draft.hook
      : cta.draft.idea ?? "Untitled draft";

    const destination = cta.draft.chat_id
      ? `/chat/${cta.draft.chat_id}`
      : "/drafts";

    return (
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📝</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-0.5">Post for today</p>
          <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">You started this — finish it and post today.</p>
        </div>
        <button
          onClick={() => navigate(destination)}
          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all duration-150 whitespace-nowrap"
        >
          Finish this →
        </button>
      </div>
    );
  }

  // type === "idea" — navigate to chat if one exists, else to ideas page
  const ideaText = cta.idea.idea ?? "Saved idea";
  const ideaDestination = (cta.idea as any).chat_id
    ? `/chat/${(cta.idea as any).chat_id}`
    : "/ideas";

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
        <span className="text-lg">{cta.idea.is_favourite ? "⭐" : "💡"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Post for today</p>
        <p className="text-sm font-medium text-slate-800 truncate">{ideaText}</p>
        <p className="text-xs text-slate-500 mt-0.5">Turn this idea into a post — you saved it for a reason.</p>
      </div>
      <button
        onClick={() => navigate(ideaDestination)}
        className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all duration-150 whitespace-nowrap"
      >
        Write it →
      </button>
    </div>
  );
}