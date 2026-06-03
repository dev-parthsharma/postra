// frontend/src/components/dashboard/ContentCalendar.tsx
// Refactored V2: Interactive Weekly Content Calendar Extension for Dashboard (Includes direct scheduler overlays & conflict checks).

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  listIdeas, 
  scheduleIdea, 
  checkDateSchedule, 
  generatePostForExistingIdea 
} from "../../lib/ideasApi";

interface CalendarPost {
  id: string;
  title: string;          
  scheduled_at: string;   
  status: "scheduled" | "published";
}

interface ContentCalendarProps {
  posts: CalendarPost[]; // Kept for prop-type backwards compatibility, internally uses V2 direct fetch
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

const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ─── MINI SCHEDULER OVERLAY MODAL FOR DASHBOARD ───
interface WidgetScheduleModalProps {
  date: string;
  scheduledIdea: any | null;
  unscheduledIdeas: any[];
  onClose: () => void;
  onSaved: () => void;
}

function WidgetScheduleModal({ date, scheduledIdea, unscheduledIdeas, onClose, onSaved }: WidgetScheduleModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(date);
  const [showRescheduleInput, setShowRescheduleInput] = useState(false);

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleAssignIdea = async (ideaId: string) => {
    setLoading(true);
    try {
      await scheduleIdea(ideaId, date);
      onSaved();
      onClose();
    } catch (err) {
      alert("Failed to assign idea.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!scheduledIdea) return;
    setLoading(true);
    try {
      await scheduleIdea(scheduledIdea.id, null);
      onSaved();
      onClose();
    } catch (err) {
      alert("Failed to remove schedule.");
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!scheduledIdea || !rescheduleDate) return;
    setLoading(true);
    try {
      const conflict = await checkDateSchedule(rescheduleDate);
      if (conflict.scheduled && conflict.existing_idea?.id !== scheduledIdea.id) {
        const proceed = window.confirm(
          `Date Conflict: Another idea is already planned for this day: "${conflict.existing_idea?.idea}".\n\nDo you want to proceed and save multiple ideas on this same day?`
        );
        if (!proceed) { setLoading(false); return; }
      }
      await scheduleIdea(scheduledIdea.id, rescheduleDate);
      onSaved();
      onClose();
    } catch (err) {
      alert("Failed to reschedule.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePost = async () => {
    if (!scheduledIdea) return;
    setLoading(true);
    try {
      const res = await generatePostForExistingIdea(scheduledIdea.id);
      onClose();
      navigate(`/chat/${res.id}`);
    } catch (err) {
      alert("Failed to generate post.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Plan Date</p>
            <h3 className="text-slate-900 dark:text-white text-sm font-bold">{formattedDate}</h3>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1 text-slate-400">✖</button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <svg className="animate-spin text-indigo-600 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">Updating...</span>
            </div>
          ) : scheduledIdea ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Scheduled Idea</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 leading-relaxed">"{scheduledIdea.title}"</p>
              </div>

              {/* Reschedule widget */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/30 border border-slate-150 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Reschedule Date</span>
                  {!showRescheduleInput && (
                    <button onClick={() => setShowRescheduleInput(true)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Change 📅</button>
                  )}
                </div>
                {showRescheduleInput && (
                  <div className="flex gap-2 items-center">
                    <input 
                      type="date"
                      value={rescheduleDate}
                      min={getTomorrowStr()}
                      onKeyDown={(e) => e.preventDefault()}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-zinc-200 outline-none"
                    />
                    <button onClick={handleReschedule} className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg">Save</button>
                  </div>
                )}
              </div>

              <div className="pt-2 space-y-2">
                {scheduledIdea.post_status === "published" ? (
                  <div className="text-center p-2.5 bg-emerald-50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-500/10">Post Published ✅</div>
                ) : (
                  <button onClick={handleGeneratePost} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-5050 text-white text-xs font-bold">Generate Post ⚡</button>
                )}
                <button onClick={handleRemoveSchedule} className="w-full py-2 rounded-xl border border-red-200 dark:border-red-500/20 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/5 text-xs font-bold">Unschedule Idea ❌</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Select Idea to Schedule</span>
              {unscheduledIdeas.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400 dark:text-zinc-500">No unscheduled ideas available.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                  {unscheduledIdeas.map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => handleAssignIdea(idea.id)}
                      className="w-full p-3 bg-slate-50 dark:bg-zinc-800/50 border border-slate-150 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500/40 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 leading-normal flex justify-between items-center gap-2 group"
                    >
                      <span className="line-clamp-2 flex-1">{idea.idea}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Schedule →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function ContentCalendar({ posts: propPosts, loading: propLoading }: ContentCalendarProps) {
  const today = new Date();
  const todayStr = localDateStr(today);

  const [selectedMonth, setSelectedMonth] = useState<string>(localMonthKey(today));
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(today));

  // ── 🟢 V2 DATA STATES ──
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthOptions = getMonthOptions(today);
  const touchStartX = useRef<number | null>(null);

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const monthFirst = new Date(selYear, selMonth - 1, 1);
  const monthLast  = endOfMonth(monthFirst);

  const loadPlannerIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listIdeas(); // Fetch direct V2 planner data
      setIdeas(data);
    } catch (err) {
      console.error("Widget fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlannerIdeas();
  }, [loadPlannerIdeas, selectedMonth]);

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

  // ── 🟢 MAP IDEAS BY PLAN DATE ──
  const ideasByDate: Record<string, any[]> = {};
  ideas.forEach((idea) => {
    if (idea.scheduled_date) {
      const key = idea.scheduled_date;
      if (!ideasByDate[key]) ideasByDate[key] = [];
      ideasByDate[key].push({
        id: idea.id,
        title: idea.idea,
        win_score: idea.win_score,
        source: idea.source,
        post_id: idea.post_id || null,
        post_status: idea.post_status || null,
      });
    }
  });

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr   = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  })();

  // Filter lists for the scheduler
  const unscheduledIdeas = ideas.filter((idea) => !idea.scheduled_date);
  const activeWidgetIdea = selectedDay && ideasByDate[selectedDay] && ideasByDate[selectedDay].length > 0
    ? ideasByDate[selectedDay][0]
    : null;

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
          const dayEvents      = ideasByDate[dateStr] ?? []; // 🟢 V2: Maps direct plan ideas
          
          const isPastEmpty = dayEvents.length === 0 && dateStr < getTomorrowStr();

          return (
            <div
              key={dateStr}
              onClick={() => {
                // 🟢 Direct schedule check: Block tapping on past empty cells
                if (isPastEmpty) {
                  alert("You can only schedule ideas for tomorrow or future dates! 📅");
                  return;
                }
                setSelectedDay(dateStr);
              }}
              className={`flex flex-col min-h-[100px] transition-colors ${
                isPastEmpty 
                  ? "bg-slate-100/10 dark:bg-zinc-950/5 opacity-40 cursor-not-allowed" // Muted past cell
                  : isToday 
                    ? "bg-indigo-50/60 dark:bg-indigo-500/[0.06] cursor-pointer hover:bg-indigo-100/30" 
                    : "cursor-pointer hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
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

              {/* Events display */}
              <div className="flex flex-col gap-1 px-1 pb-3 overflow-hidden">
                {loading ? (
                  i % 3 === 0 && <div className="h-5 bg-slate-100 dark:bg-white/[0.05] rounded animate-pulse mx-0.5" />
                ) : dayEvents.length === 0 ? null : (
                  dayEvents.slice(0, 1).map((ev) => (
                    <div
                      key={ev.id}
                      title={ev.title}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-tight truncate border ${
                        ev.post_status === "published"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : ev.post_id 
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                            : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                      }`}
                    >
                      {ev.title.length > 14 ? ev.title.slice(0, 14) + "…" : ev.title}
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
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/10 border border-indigo-500/20" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Idea Planned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/10 border border-amber-500/20" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Draft Post</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Published</span>
        </div>
      </div>

      {/* ── 🟢 DASHBOARD WIDGET SCHEDULER OVERLAY MODAL ── */}
      {selectedDay && (
        <WidgetScheduleModal
          date={selectedDay}
          scheduledIdea={activeWidgetIdea}
          unscheduledIdeas={unscheduledIdeas}
          onClose={() => setSelectedDay(null)}
          onSaved={loadPlannerIdeas}
        />
      )}

    </div>
  );
}