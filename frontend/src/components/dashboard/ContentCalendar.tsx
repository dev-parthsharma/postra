// frontend/src/components/dashboard/ContentCalendar.tsx
import { useState, useRef } from "react";
import type { CalendarPost } from "../../hooks/useDashboard";

interface ContentCalendarProps {
  posts: CalendarPost[];
  loading: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function toLocalDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns YYYY-MM string for a date */
function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** All 12 months of the current year, plus prev/next year for edge months */
function getMonthOptions(today: Date): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  // Show 6 months back and 6 months forward from today
  for (let i = -6; i <= 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    options.push({
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      value: toMonthKey(d),
    });
  }
  return options;
}

/** Last day of the month that contains `date` */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** First day of the month that contains `date` */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function ContentCalendar({ posts, loading }: ContentCalendarProps) {
  const today = new Date();

  // selectedMonth drives the dropdown; weekStart must stay within that month
  const [selectedMonth, setSelectedMonth] = useState<string>(toMonthKey(today));
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(today));

  const monthOptions = getMonthOptions(today);

  // touch swipe support
  const touchStartX = useRef<number | null>(null);

  // ── Month boundary helpers ────────────────────────────────────────────────

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const monthFirst = new Date(selYear, selMonth - 1, 1);
  const monthLast  = endOfMonth(monthFirst);

  // Clamp a weekStart date so the week visible stays inside selectedMonth.
  // A week is "inside" if any day of that week falls in the month.
  function clampWeekToMonth(ws: Date, mFirst: Date, mLast: Date): Date {
    const weekEnd = addDays(ws, 6);
    // If the whole week is before the month, jump to first week of month
    if (weekEnd < mFirst) return getWeekStart(mFirst);
    // If the whole week is after the month, jump to last week of month
    if (ws > mLast) return getWeekStart(mLast);
    return ws;
  }

  const goToPrevWeek = () => {
    setWeekStart((w) => {
      const prev = addDays(w, -7);
      return clampWeekToMonth(prev, monthFirst, monthLast);
    });
  };

  const goToNextWeek = () => {
    setWeekStart((w) => {
      const next = addDays(w, 7);
      return clampWeekToMonth(next, monthFirst, monthLast);
    });
  };

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    const [y, m] = value.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    setWeekStart(getWeekStart(first));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? goToNextWeek() : goToPrevWeek();
    }
    touchStartX.current = null;
  };

  // ── Determine prev/next disabled state ───────────────────────────────────

  const prevWeekEnd   = addDays(weekStart, -1);       // last day of prev week
  const nextWeekStart = addDays(weekStart, 7);         // first day of next week
  const isPrevDisabled = prevWeekEnd < monthFirst;
  const isNextDisabled = nextWeekStart > monthLast;

  // ── Build 7 day cells ─────────────────────────────────────────────────────

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // map posts to their date
  const postsByDate: Record<string, CalendarPost[]> = {};
  for (const post of posts) {
    const key = post.scheduled_at.slice(0, 10);
    if (!postsByDate[key]) postsByDate[key] = [];
    postsByDate[key].push(post);
  }

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr   = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  })();

  const todayStr = toLocalDateStr(today);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Content Calendar</h2>
          <p className="text-xs text-slate-400 mt-0.5">{weekLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month filter dropdown — full range */}
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Prev — disabled at month boundary */}
          <button
            onClick={goToPrevWeek}
            disabled={isPrevDisabled}
            className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous week"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next — disabled at month boundary */}
          <button
            onClick={goToNextWeek}
            disabled={isNextDisabled}
            className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next week"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar grid — swipeable */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="grid grid-cols-7 divide-x divide-slate-100"
      >
        {days.map((day, i) => {
          const dateStr  = toLocalDateStr(day);
          const isToday  = dateStr === todayStr;
          // Dim days that fall outside the selected month
          const isOutsideMonth = toMonthKey(day) !== selectedMonth;
          const dayPosts = postsByDate[dateStr] ?? [];

          return (
            <div
              key={dateStr}
              className={`flex flex-col min-h-[100px] ${isToday ? "bg-indigo-50/60" : ""} ${isOutsideMonth ? "opacity-30" : ""}`}
            >
              {/* Day header */}
              <div className={`flex flex-col items-center pt-3 pb-2 ${isToday ? "text-indigo-600" : "text-slate-400"}`}>
                <span className="text-[10px] font-semibold uppercase tracking-wide">{DAYS[i]}</span>
                <span className={`text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700"}`}>
                  {day.getDate()}
                </span>
              </div>

              {/* Posts */}
              <div className="flex flex-col gap-1 px-1 pb-3">
                {loading ? (
                  i % 3 === 0 && (
                    <div className="h-5 bg-slate-100 rounded animate-pulse mx-0.5" />
                  )
                ) : dayPosts.length === 0 ? null : (
                  dayPosts.map((post) => (
                    <div
                      key={post.id}
                      title={post.title}
                      className={`text-[10px] font-medium px-1.5 py-1 rounded-md leading-tight truncate ${
                        post.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-indigo-100 text-indigo-700"
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
      <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-200" />
          <span className="text-[11px] text-slate-500">Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" />
          <span className="text-[11px] text-slate-500">Published</span>
        </div>
      </div>
    </div>
  );
}