// frontend/src/pages/Calendar.tsx
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD local
  title: string;
  status: "scheduled" | "published" | "draft" | "ready";
  chat_id: string | null;
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

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-indigo-100 text-indigo-700",
  published: "bg-emerald-100 text-emerald-700",
  draft:     "bg-amber-100 text-amber-700",
  ready:     "bg-orange-100 text-orange-700",
};

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-md leading-tight truncate transition-all hover:brightness-95 ${STATUS_STYLE[event.status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {event.title}
    </button>
  );
}

interface DayDetailProps {
  date: string;
  events: CalendarEvent[];
  onClose: () => void;
  onNavigate: (event: CalendarEvent) => void;
}

function DayDetail({ date, events, onClose, onNavigate }: DayDetailProps) {
  const d = new Date(date + "T00:00:00");
  const label = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {d.toLocaleDateString("en-IN", { weekday: "long" })}
            </p>
            <h3 className="text-slate-900 font-bold">{d.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Nothing scheduled for this day.</p>
          ) : (
            events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onNavigate(ev)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all text-left"
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  ev.status === "published" ? "bg-emerald-400" :
                  ev.status === "scheduled" ? "bg-indigo-400" :
                  ev.status === "ready"     ? "bg-orange-400" : "bg-amber-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
                  <p className="text-xs text-slate-400 capitalize">{ev.status}</p>
                </div>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-slate-300 flex-shrink-0">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const [{ data: scheduled }, { data: published }, { data: drafts }] = await Promise.all([
        supabase
          .from("schedules")
          .select("id, scheduled_at, posts!inner(id, chat_id, idea, hook, user_id)")
          .eq("posts.user_id", user.id)
          .eq("status", "scheduled")
          .gte("scheduled_at", start)
          .lte("scheduled_at", end),
        supabase
          .from("posts")
          .select("id, chat_id, idea, hook, posted_at, created_at")
          .eq("user_id", user.id)
          .eq("status", "published")
          .gte("created_at", start)
          .lte("created_at", end),
        supabase
          .from("posts")
          .select("id, chat_id, idea, hook, status, updated_at")
          .eq("user_id", user.id)
          .in("status", ["draft", "ready"])
          .gte("updated_at", start)
          .lte("updated_at", end),
      ]);

      const evts: CalendarEvent[] = [
        ...(scheduled ?? []).map((s: any) => ({
          id: `sched-${s.id}`,
          date: localDate(s.scheduled_at),
          title: (s.posts?.hook || s.posts?.idea || "Scheduled post").slice(0, 60),
          status: "scheduled" as const,
          chat_id: s.posts?.chat_id ?? null,
        })),
        ...(published ?? []).map((p: any) => ({
          id: `pub-${p.id}`,
          date: localDate(p.posted_at || p.created_at),
          title: (p.hook || p.idea || "Published post").slice(0, 60),
          status: "published" as const,
          chat_id: p.chat_id,
        })),
        ...(drafts ?? []).map((d: any) => ({
          id: `draft-${d.id}`,
          date: localDate(d.updated_at),
          title: (d.hook || d.idea || "Draft").slice(0, 60),
          status: d.status as "draft" | "ready",
          chat_id: d.chat_id,
        })),
      ];

      setEvents(evts);
      setLoading(false);
    };
    load();
  }, [year, month]);

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

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  const totalEvents = events.length;
  const publishedCount = events.filter((e) => e.status === "published").length;
  const scheduledCount = events.filter((e) => e.status === "scheduled").length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Content Calendar</h1>
            <p className="text-slate-500 text-sm mt-1">Your full posting schedule at a glance.</p>
          </div>
          {/* Mini stats */}
          <div className="flex gap-3">
            {[
              { label: "Scheduled", count: scheduledCount, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
              { label: "Published", count: publishedCount, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            ].map((s) => (
              <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${s.color}`}>
                <span className="text-base">{s.count}</span>
                <span className="text-xs opacity-70">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Calendar nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <button
              type="button"
              onClick={goToToday}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-200 transition-all"
            >
              Today
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goToPrev}
                className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-slate-900 min-w-[160px] text-center">
                {MONTHS[month]} {year}
              </h2>
              <button
                type="button"
                onClick={goToNext}
                className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="w-16" /> {/* spacer */}
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className="grid grid-cols-7 divide-x divide-slate-50"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {cells.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[100px] bg-slate-50/30" />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const dayEvents = eventsByDate[dateStr] ?? [];
              const isSelected = selectedDay === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={`min-h-[80px] sm:min-h-[100px] flex flex-col cursor-pointer transition-colors ${
                    isToday ? "bg-indigo-50/60" : isSelected ? "bg-slate-50" : "hover:bg-slate-50/60"
                  } ${i % 7 !== 0 ? "border-l border-slate-50" : ""} ${i >= 7 ? "border-t border-slate-50" : ""}`}
                >
                  {/* Day number */}
                  <div className="flex justify-center pt-2 pb-1.5">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600"
                    }`}>
                      {day}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="px-1 pb-2 space-y-0.5 flex-1">
                    {loading ? (
                      day % 4 === 0 && <div className="h-3.5 bg-slate-100 rounded animate-pulse mx-0.5" />
                    ) : (
                      <>
                        {dayEvents.slice(0, 3).map((ev) => (
                          <EventChip key={ev.id} event={ev} onClick={() => setSelectedDay(dateStr)} />
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-[9px] text-slate-400 pl-1.5">+{dayEvents.length - 3} more</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50/40">
            {[
              { label: "Scheduled", className: "bg-indigo-100 text-indigo-700" },
              { label: "Published", className: "bg-emerald-100 text-emerald-700" },
              { label: "Ready",     className: "bg-orange-100 text-orange-700" },
              { label: "Draft",     className: "bg-amber-100 text-amber-700" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={`w-5 h-3 rounded-sm text-[9px] font-semibold flex items-center justify-center ${l.className}`} />
                <span className="text-[11px] text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day detail modal */}
        {selectedDay && (
          <DayDetail
            date={selectedDay}
            events={selectedEvents}
            onClose={() => setSelectedDay(null)}
            onNavigate={(ev) => {
              setSelectedDay(null);
              if (ev.chat_id) navigate(`/chat/${ev.chat_id}`);
              else if (ev.status === "published") navigate("/published");
              else navigate("/drafts");
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}