// src/components/dashboard/ContentCalendar.tsx
import { useState, useRef } from "react";
import type { CalendarPost } from "../../hooks/useDashboard";

interface ContentCalendarProps {
  posts: CalendarPost[];
  loading: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localMonthKey(date: Date): string {
  return localDateStr(date).slice(0, 7);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getMonthOptions(today: Date): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let i = -6; i <= 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    options.push({
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      value: localMonthKey(d),
    });
  }
  return options;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function clampWeekToMonth(ws: Date, mFirst: Date, mLast: Date): Date {
  const weekEnd = addDays(ws, 6);
  if (weekEnd < mFirst) return getWeekStart(mFirst);
  if (ws > mLast) return getWeekStart(mLast);
  return ws;
}

export default function ContentCalendar({ posts, loading }: ContentCalendarProps) {
  const today = new Date();
  const todayStr = localDateStr(today);

  const [selectedMonth, setSelectedMonth] = useState<string>(localMonthKey(today));
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(today));

  const monthOptions = getMonthOptions(today);
  const touchStartX = useRef<number | null>(null);

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const monthFirst = new Date(selYear, selMonth - 1, 1);
  const monthLast  = endOfMonth(monthFirst);

  const goToPrevWeek = () =>
    setWeekStart((w) => clampWeekToMonth(addDays(w, -7), monthFirst, monthLast));
  const goToNextWeek = () =>
    setWeekStart((w) => clampWeekToMonth(addDays(w, 7), monthFirst, monthLast));

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    const [y, m] = value.split("-").map(Number);
    setWeekStart(getWeekStart(new Date(y, m - 1, 1)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? goToNextWeek() : goToPrevWeek();
    touchStartX.current = null;
  };

  const isPrevDisabled = addDays(weekStart, -1) < monthFirst;
  const isNextDisabled = addDays(weekStart, 7) > monthLast;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const postsByDate: Record<string, CalendarPost[]> = {};
  for (const post of posts) {
    const key = localDateStr(new Date(post.scheduled_at));
    if (!postsByDate[key]) postsByDate[key] = [];
    postsByDate[key].push(post);
  }

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr   = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  })();

  return (
    <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Content Calendar</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{weekLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/30 cursor-pointer"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            onClick={goToPrevWeek}
            disabled={isPrevDisabled}
            className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextWeek}
            disabled={isNextDisabled}
            className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-white/[0.04]"
      >
        {days.map((day, i) => {
          const dateStr        = localDateStr(day);
          const isToday        = dateStr === todayStr;
          const isOutsideMonth = localMonthKey(day) !== selectedMonth;
          const dayPosts       = postsByDate[dateStr] ?? [];

          return (
            <div
              key={dateStr}
              className={`flex flex-col min-h-[100px] ${
                isToday ? "bg-indigo-50/60 dark:bg-indigo-500/[0.06]" : ""
              } ${isOutsideMonth ? "opacity-30" : ""}`}
            >
              <div className={`flex flex-col items-center pt-3 pb-2 ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}>
                <span className="text-[10px] font-semibold uppercase tracking-wide">{DAYS[i]}</span>
                <span className={`text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 dark:text-slate-200"
                }`}>
                  {day.getDate()}
                </span>
              </div>

              <div className="flex flex-col gap-1 px-1 pb-3">
                {loading ? (
                  i % 3 === 0 && <div className="h-5 bg-slate-100 dark:bg-white/[0.05] rounded animate-pulse mx-0.5" />
                ) : dayPosts.length === 0 ? null : (
                  dayPosts.map((post) => (
                    <div
                      key={post.id}
                      title={post.title}
                      className={`text-[10px] font-medium px-1.5 py-1 rounded-md leading-tight truncate ${
                        post.status === "published"
                          ? "bg-emerald-100 dark:bg-emerald-500/[0.15] text-emerald-700 dark:text-emerald-400"
                          : "bg-indigo-100 dark:bg-indigo-500/[0.15] text-indigo-700 dark:text-indigo-400"
                      }`}
                    >
                      {post.title.length > 18 ? post.title.slice(0, 18) + "…" : post.title}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Published</span>
        </div>
      </div>
    </div>
  );
}