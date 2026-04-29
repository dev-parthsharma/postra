// frontend/src/components/dashboard/RecentDrafts.tsx
import { useNavigate } from "react-router-dom";
import type { DraftPost } from "../../hooks/useDashboard";

interface RecentDraftsProps {
  drafts: DraftPost[];
  loading: boolean;
}

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  idea: {
    label: "Idea",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  scheduled: {
    label: "Sched.",
    className: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  },
  published: {
    label: "Live",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
};

function getContentType(post: DraftPost): string {
  const idea = post.idea?.toLowerCase() ?? "";
  
  // 🟢 FIX: Check if it's a real hook vs a temporary placeholder
  const isTempHook = post.hook === post.idea || (post as any).chat_title === post.hook;
  const hasRealHook = !!post.hook && !isTempHook;
  
  // Bypass TS types for new fields
  const hasScript = !!(post as any).script;
  const hasCaption = !!(post as any).caption; // <-- FIX: used (post as any)

  if (idea.includes("carousel")) return "Carousel";
  if (idea.includes("story")) return "Story";

  if (hasCaption) return "Reel · Caption ready";
  if (hasScript) return "Reel · Script ready";
  if (hasRealHook) return "Reel · Hook ready";
  
  return "Reel · Idea stage";
}

function PostIcon({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-amber-100",
    idea: "bg-blue-100",
    scheduled: "bg-indigo-100",
    published: "bg-emerald-100",
  };
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[status] ?? "bg-slate-100"}`}>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-slate-600">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
      </div>
      <div className="h-6 w-14 bg-slate-100 rounded-full animate-pulse" />
    </div>
  );
}

export default function RecentDrafts({ drafts, loading }: RecentDraftsProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📝</span>
          <h2 className="text-base font-semibold text-slate-800">Recent Drafts</h2>
        </div>
        <button
          onClick={() => navigate("/drafts")}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View all →
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : drafts.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-1">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-400">No drafts yet</p>
            <p className="text-xs text-slate-300">Start creating your first post</p>
          </div>
        ) : (
          drafts.map((post) => {
            const statusCfg = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
            const contentType = getContentType(post);
            return (
              <div
                key={post.id}
                className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors duration-100"
                onClick={() => navigate("/drafts")}
              >
                <PostIcon status={post.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate leading-snug">
                    {post.idea ?? "Untitled post"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{contentType}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusCfg.className}`}>
                  {statusCfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}