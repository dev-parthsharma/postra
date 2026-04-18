// src/components/dashboard/StatsCards.tsx

interface StatsCardsProps {
  postsThisMonth: number;
  ideasSaved: number;
  postStreak: number;
  loading: boolean;
}

function streakMessage(streak: number): string {
  if (streak === 0) return "Post today to start your streak!";
  if (streak === 1) return "You posted today — keep it going!";
  if (streak < 5)   return `You're on a ${streak}-day roll. Don't stop now.`;
  if (streak < 10)  return `${streak} days in a row — one missing day = reach drop.`;
  if (streak < 20)  return `Don't break your ${streak}-day streak. Algorithms love consistency.`;
  return `${streak} days straight. You're built different.`;
}

function streakColor(streak: number): { bg: string; accent: string; ring: string; text: string } {
  if (streak === 0) return {
    bg: "bg-slate-50 dark:bg-white/[0.03]",
    accent: "text-slate-400 dark:text-slate-500",
    ring: "border-slate-100 dark:border-white/[0.06]",
    text: "text-slate-500 dark:text-slate-400"
  };
  if (streak < 5)   return {
    bg: "bg-amber-50 dark:bg-amber-500/[0.08]",
    accent: "text-amber-500",
    ring: "border-amber-100 dark:border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400"
  };
  if (streak < 10)  return {
    bg: "bg-orange-50 dark:bg-orange-500/[0.08]",
    accent: "text-orange-500",
    ring: "border-orange-100 dark:border-orange-500/20",
    text: "text-orange-700 dark:text-orange-400"
  };
  return {
    bg: "bg-red-50 dark:bg-red-500/[0.08]",
    accent: "text-red-500",
    ring: "border-red-100 dark:border-red-500/20",
    text: "text-red-700 dark:text-red-400"
  };
}

export default function StatsCards({ postsThisMonth, ideasSaved, postStreak, loading }: StatsCardsProps) {
  const colors = streakColor(postStreak);
  const message = streakMessage(postStreak);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

      {/* Posts this month */}
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-5 flex flex-col gap-3 shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-shadow duration-200">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-indigo-600 dark:text-indigo-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-14 bg-slate-100 dark:bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-3.5 w-28 bg-slate-100 dark:bg-white/[0.06] rounded animate-pulse" />
          </div>
        ) : (
          <div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-1">
              {postsThisMonth}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Posts this month</div>
          </div>
        )}
      </div>

      {/* Ideas saved */}
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-5 flex flex-col gap-3 shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-shadow duration-200">
        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-amber-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-14 bg-slate-100 dark:bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-3.5 w-24 bg-slate-100 dark:bg-white/[0.06] rounded animate-pulse" />
          </div>
        ) : (
          <div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-1">
              {ideasSaved}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ideas saved</div>
          </div>
        )}
      </div>

      {/* Streak */}
      <div className={`rounded-2xl border ${colors.ring} ${colors.bg} p-5 flex flex-col gap-3 shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-shadow duration-200`}>
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-xl bg-white/70 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-lg">🔥</span>
          </div>
          {!loading && postStreak > 0 && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-white/60 dark:bg-white/[0.06] ${colors.accent}`}>
              Active streak
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 w-20 bg-white/50 dark:bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-3.5 w-36 bg-white/50 dark:bg-white/[0.06] rounded animate-pulse" />
          </div>
        ) : (
          <div>
            <div className={`text-4xl font-bold tracking-tight leading-none mb-1.5 ${postStreak > 0 ? colors.accent : "text-slate-300 dark:text-slate-600"}`}>
              {postStreak}
              <span className="text-base font-semibold ml-1.5 opacity-70">
                {postStreak === 1 ? "day" : "days"}
              </span>
            </div>
            <div className={`text-xs font-medium leading-snug ${colors.text}`}>
              {message}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}