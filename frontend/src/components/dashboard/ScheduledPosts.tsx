// frontend/src/components/dashboard/ScheduledPosts.tsx
import { useNavigate } from "react-router-dom";
import type { ScheduledPost } from "../../hooks/useDashboard";

interface ScheduledPostsProps {
  posts: ScheduledPost[];
  scheduledThisWeek: number;
  loading: boolean;
}

function formatScheduledDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[date.getDay()];

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  const diffDays = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return `Today · ${hour12}:${minutes} ${ampm} IST`;
  if (diffDays === 1) return `Tomorrow · ${hour12}:${minutes} ${ampm} IST`;
  return `${dayName} · ${hour12}:${minutes} ${ampm} IST`;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
      </div>
      <div className="h-6 w-14 bg-slate-100 rounded-full animate-pulse" />
    </div>
  );
}

export default function ScheduledPosts({ posts, scheduledThisWeek, loading }: ScheduledPostsProps) {
  const navigate = useNavigate();

  // How many more this week beyond the 3 shown
  const moreThisWeek = Math.max(0, scheduledThisWeek - posts.length);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <h2 className="text-base font-semibold text-slate-800">Scheduled Posts</h2>
        </div>
        <button
          onClick={() => navigate("/scheduled")}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View all →
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50 flex-1">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : posts.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-1">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-400">Nothing scheduled</p>
            <p className="text-xs text-slate-300">Schedule a post to see it here</p>
          </div>
        ) : (
          posts.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors duration-100"
              onClick={() => navigate("/scheduled")}
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-indigo-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate leading-snug">
                  {item.post?.idea ?? "Scheduled post"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatScheduledDate(item.scheduled_at)}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex-shrink-0">
                Sched.
              </span>
            </div>
          ))
        )}
      </div>

      {/* More this week footer */}
      {!loading && moreThisWeek > 0 && (
        <button
          onClick={() => navigate("/scheduled")}
          className="mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400 hover:text-indigo-600 transition-colors text-center font-medium w-full"
        >
          + {moreThisWeek} more this week
        </button>
      )}
    </div>
  );
}