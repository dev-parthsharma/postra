// frontend/src/pages/Calendar.tsx
// Refactored V2: Simple Idea Scheduling & Planning Calendar (No legacy chat/message dependencies).

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DashboardLayout from "../components/layout/DashboardLayout";
import { 
  listIdeas, 
  scheduleIdea, 
  checkDateSchedule, 
  generatePostForExistingIdea 
} from "../lib/ideasApi";

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  win_score: number;
  source: string;
  post_id: string | null;
  post_status: string | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function localDate(input: string | Date): string {
  const d = new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Tomorrow helper for reschedule constraints
const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function Spinner({ small = false, size = 16 }: { small?: boolean; size?: number }) {
  return (
    <svg className="animate-spin text-indigo-600" style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── 🟢 INLINE SCHEDULER & DETAILS MODAL OVERLAY ───
interface ScheduleModalProps {
  date: string;
  scheduledIdea: any | null;
  unscheduledIdeas: any[];
  onClose: () => void;
  onSaved: () => void;
}

function ScheduleModal({ date, scheduledIdea, unscheduledIdeas, onClose, onSaved }: ScheduleModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(date);
  const [showRescheduleInput, setShowRescheduleInput] = useState(false);

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Assign Unscheduled Idea to this date
  const handleAssignIdea = async (ideaId: string) => {
    setLoading(true);
    try {
      await scheduleIdea(ideaId, date);
      onSaved();
      onClose();
    } catch (err) {
      alert("Failed to assign idea. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Remove/Unschedule this idea
  const handleRemoveSchedule = async () => {
    if (!scheduledIdea) return;
    setLoading(true);
    try {
      await scheduleIdea(scheduledIdea.id, null); // Passes null to unschedule
      onSaved();
      onClose();
    } catch (err) {
      alert("Failed to remove schedule.");
    } finally {
      setLoading(false);
    }
  };

  // Reschedule this idea to another date
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
      navigate(`/chat/${res.id}`); // Direct opens post editor!
    } catch (err) {
      alert("Failed to auto-generate post.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Plan Date</p>
            <h3 className="text-slate-900 dark:text-white font-bold">{formattedDate}</h3>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
            ✖
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Spinner size={24} />
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">Updating planner...</span>
            </div>
          ) : scheduledIdea ? (
            /* ── VIEW / EDIT SCHEDULED IDEA ── */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Scheduled Idea</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 leading-relaxed">
                  "{scheduledIdea.title}"
                </p>
              </div>

              {/* Action: Reschedule Date picker */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 border border-slate-150 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Reschedule/Edit Date</span>
                  {!showRescheduleInput && (
                    <button 
                      onClick={() => setShowRescheduleInput(true)} 
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      Change Date 📅
                    </button>
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
                      className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-200 outline-none"
                    />
                    <button 
                      onClick={handleReschedule}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Action Triggers */}
              <div className="pt-2 space-y-3">
                {scheduledIdea.post_status === "published" ? (
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                    Post Published ✅
                  </div>
                ) : (
                  <button
                    onClick={handleGeneratePost}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/10 transition-all active:scale-95"
                  >
                    Generate Post ⚡
                  </button>
                )}
                
                <button
                  onClick={handleRemoveSchedule}
                  className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-bold transition-colors"
                >
                  Unschedule Idea ❌
                </button>
              </div>
            </div>
          ) : (
            /* ── SCHEDULE NEW AVAILABLE IDEA ── */
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                Select Idea to Schedule
              </span>
              
              {unscheduledIdeas.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 dark:text-zinc-500">No unscheduled ideas available.</p>
                  <button
                    onClick={() => navigate("/ideas")}
                    className="mt-3 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg shadow-sm"
                  >
                    Go to Ideas Page
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {unscheduledIdeas.map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => handleAssignIdea(idea.id)}
                      className="w-full p-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-150 dark:border-zinc-800/80 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/40 rounded-2xl text-left text-xs font-semibold leading-relaxed text-slate-800 dark:text-zinc-200 transition-all flex justify-between items-center gap-2 group"
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

export default function CalendarPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scheduling states
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listIdeas(); // Direct listIdeas V2 fetch
      setIdeas(data);
    } catch (err) {
      console.error("Failed to load ideas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, year, month]);

  const goToPrev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const goToNext = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const goToToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? goToNext() : goToPrev();
    touchStartX.current = null;
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = localDate(today);

  // Group events by local date
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  
  // 🟢 V2 Idea mapping: Map ideas with scheduled_date to cell dates
  ideas.forEach((idea) => {
    if (idea.scheduled_date) {
      const dateStr = idea.scheduled_date;
      if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
      
      eventsByDate[dateStr].push({
        id: idea.id,
        date: dateStr,
        title: idea.idea.slice(0, 60),
        win_score: idea.win_score,
        source: idea.source,
        post_id: idea.post_id || null,
        post_status: idea.post_status || null,
      });
    }
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Unscheduled ideas list to show in scheduler popup
  const unscheduledIdeas = ideas.filter((idea) => !idea.scheduled_date);

  // Idea currently scheduled on selected day (if any)
  const activeScheduledIdea = selectedDay && eventsByDate[selectedDay] && eventsByDate[selectedDay].length > 0
    ? eventsByDate[selectedDay][0]
    : null;

  const totalPlannedThisMonth = ideas.filter((i) => {
    if (!i.scheduled_date) return false;
    const d = new Date(i.scheduled_date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Content Calendar</h1>
            <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Schedule and review planned content concepts.</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl">
              <span className="text-base font-bold">{totalPlannedThisMonth}</span>
              <span className="opacity-70">Planned This Month</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Calendar nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={goToToday}
              className="text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 transition-all"
            >
              Today
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goToPrev}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-750 transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-slate-900 dark:text-white min-w-[160px] text-center">
                {MONTHS[month]} {year}
              </h2>
              <button
                type="button"
                onClick={goToNext}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-750 transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="w-16" /> {/* spacer */}
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-zinc-800">
            {DAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-zinc-800"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {cells.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[100px] bg-slate-50/20 dark:bg-zinc-950/20" />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const dayEvents = eventsByDate[dateStr] ?? [];
              const isSelected = selectedDay === dateStr;
            
              // 🟢 Check if this cell represents an empty past date
              const isPastEmpty = dayEvents.length === 0 && dateStr < getTomorrowStr();
            
              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    // 🟢 Block scheduling on past empty dates or today's empty cells
                    if (isPastEmpty) {
                      alert("You can only schedule ideas for tomorrow or future dates! 📅");
                      return;
                    }
                    setSelectedDay(dateStr);
                  }}
                  /* 🟢 Dynamic Classes: Past empty dates are beautifully greyed out & disabled */
                  className={`min-h-[80px] sm:min-h-[100px] flex flex-col transition-colors ${
                    isPastEmpty 
                      ? "bg-slate-100/10 dark:bg-zinc-950/5 opacity-40 cursor-not-allowed" // Greyed-out style
                      : isToday 
                        ? "bg-indigo-500/10 cursor-pointer hover:bg-indigo-500/15" 
                        : isSelected 
                          ? "bg-slate-100/50 dark:bg-zinc-850 cursor-pointer" 
                          : "hover:bg-slate-50/60 dark:hover:bg-zinc-850/50 cursor-pointer"
                  } ${i % 7 !== 0 ? "border-l border-slate-100 dark:border-zinc-800" : ""} ${i >= 7 ? "border-t border-slate-100 dark:border-zinc-800" : ""}`}
                >
                  {/* Day number */}
                  <div className="flex justify-center pt-2 pb-1.5">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400"
                    }`}>
                      {day}
                    </span>
                  </div>
                  
                  {/* Events */}
                  <div className="px-1 pb-2 space-y-0.5 flex-1 overflow-hidden">
                    {loading ? (
                      day % 4 === 0 && <div className="h-3.5 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse mx-0.5" />
                    ) : (
                      <>
                        {dayEvents.slice(0, 1).map((ev) => (
                          <div
                            key={ev.id}
                            className={`w-full text-left text-[10px] font-bold px-1.5 py-1 rounded-lg leading-tight truncate border ${
                              ev.post_status === "published" 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                : ev.post_id 
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" 
                                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                            }`}
                          >
                            {ev.title}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-850/20">
            {[
              { label: "Idea Planned", className: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400" },
              { label: "Draft Post",    className: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" },
              { label: "Post Published", className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={`w-5 h-3 rounded-sm text-[9px] font-semibold border flex items-center justify-center ${l.className}`} />
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SCHEDULE / OVERLAY DETAILS MODAL ── */}
        {selectedDay && (
          <ScheduleModal
            date={selectedDay}
            scheduledIdea={activeScheduledIdea}
            unscheduledIdeas={unscheduledIdeas}
            onClose={() => setSelectedDay(null)}
            onSaved={loadData}
          />
        )}
      </div>
    </DashboardLayout>
  );
}