// frontend/src/pages/Scheduled.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DashboardLayout from "../components/layout/DashboardLayout";

interface ScheduleItem {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "cancelled";
  post: {
    id: string;
    chat_id: string | null;
    idea: string | null;
    hook: string | null;
    caption: string | null;
    hashtags: string[] | null;
  } | null;
}

function formatDate(iso: string): { day: string; time: string; relative: string; full: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const timeStr = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const fullStr = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  let relative: string;
  if (diffMs < 0) relative = "Past";
  else if (diffMins < 60) relative = `in ${diffMins}m`;
  else if (diffHrs < 24) relative = `in ${diffHrs}h`;
  else if (diffDays === 0) relative = "Today";
  else if (diffDays === 1) relative = "Tomorrow";
  else relative = `in ${diffDays}d`;

  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return { day, time: timeStr, relative, full: fullStr };
}

function groupByDate(items: ScheduleItem[]): Record<string, ScheduleItem[]> {
  const groups: Record<string, ScheduleItem[]> = {};
  for (const item of items) {
    const d = new Date(item.scheduled_at);
    const key = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function ScheduleCard({ item, onCancel, onNavigate }: {
  item: ScheduleItem;
  onCancel: (id: string) => void;
  onNavigate: (chatId: string | null) => void;
}) {
  const { day, time, relative } = formatDate(item.scheduled_at);
  const isPast = new Date(item.scheduled_at) < new Date();

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
      isPast ? "border-slate-100 opacity-60" : "border-slate-200"
    }`}>
      {/* Time strip */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
        isPast ? "bg-slate-50 border-slate-100" : "bg-indigo-50/60 border-indigo-100/60"
      }`}>
        <div className="flex items-center gap-2">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={isPast ? "text-slate-400" : "text-indigo-500"}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`text-xs font-semibold ${isPast ? "text-slate-500" : "text-indigo-700"}`}>{time} IST</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isPast
            ? "bg-slate-100 text-slate-400"
            : "bg-indigo-100 text-indigo-600"
        }`}>{relative}</span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isPast ? "bg-slate-100" : "bg-indigo-50"
          }`}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className={isPast ? "text-slate-400" : "text-indigo-500"}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 text-sm font-medium line-clamp-2">
              {item.post?.hook || item.post?.idea || "Scheduled post"}
            </p>
            {item.post?.caption && (
              <p className="text-slate-400 text-xs mt-1 line-clamp-1">{item.post.caption}</p>
            )}
          </div>
        </div>

        {/* Hashtags */}
        {item.post?.hashtags && item.post.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.post.hashtags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-100">{tag}</span>
            ))}
            {item.post.hashtags.length > 4 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-100">+{item.post.hashtags.length - 4}</span>
            )}
          </div>
        )}

        {/* Actions */}
        {!isPast && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onNavigate(item.post?.chat_id ?? null)}
              className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-all"
            >
              View draft →
            </button>
            <button
              type="button"
              onClick={() => onCancel(item.id)}
              className="text-xs px-3 py-2 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="h-10 bg-slate-50 border-b border-slate-100 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScheduledPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("schedules")
        .select(`id, scheduled_at, status, posts!inner(id, chat_id, idea, hook, caption, hashtags, user_id)`)
        .eq("posts.user_id", user.id)
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true });

      if (data) {
        setItems(data.map((d: any) => ({
          ...d,
          post: d.posts ? {
            ...d.posts,
            hashtags: Array.isArray(d.posts.hashtags) ? d.posts.hashtags : null,
          } : null,
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleCancel = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("schedules").update({ status: "cancelled" }).eq("id", id);
  };

  const now = new Date();
  const upcoming = items.filter((i) => new Date(i.scheduled_at) >= now);
  const past = items.filter((i) => new Date(i.scheduled_at) < now);
  const displayed = tab === "upcoming" ? upcoming : past;
  const groups = groupByDate(displayed);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Scheduled</h1>
            <p className="text-slate-500 text-sm mt-1">
              {upcoming.length === 0 ? "No upcoming posts" : `${upcoming.length} post${upcoming.length !== 1 ? "s" : ""} scheduled`}
            </p>
          </div>
          {upcoming.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs font-medium text-indigo-600">{upcoming.length} upcoming</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t} ({t === "upcoming" ? upcoming.length : past.length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">
              {tab === "upcoming" ? "Nothing scheduled yet" : "No past scheduled posts"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {tab === "upcoming" ? "Complete a draft and schedule it to post automatically." : "Past posts will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([dateLabel, groupItems]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{dateLabel}</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {groupItems.map((item) => (
                    <ScheduleCard
                      key={item.id}
                      item={item}
                      onCancel={handleCancel}
                      onNavigate={(chatId) => chatId ? navigate(`/chat/${chatId}`) : navigate("/drafts")}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}