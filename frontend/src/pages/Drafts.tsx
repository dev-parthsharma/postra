import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DashboardLayout from "../components/layout/DashboardLayout";

interface Draft {
  id: string;
  chat_id: string | null;
  idea_id: string | null;
  hook: string | null;
  caption: string | null;
  status: "draft" | "ready" | "idea";
  created_at: string;
  updated_at: string;
  idea?: string | null;
}

type FilterStatus = "all" | "draft" | "ready";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string }> = {
    draft:   { label: "Draft",    className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    ready:   { label: "Ready",    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    idea:    { label: "Idea",     className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  };
  const c = cfg[status] ?? cfg.draft;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${c.className}`}>
      {c.label}
    </span>
  );
}

function StageBar({ hook, caption }: { hook: string | null; caption: string | null }) {
  const steps =[
    { label: "Hook",     done: !!hook },
    { label: "Caption",  done: !!caption },
  ];
  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all ${
            s.done
              ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
              : "bg-zinc-800 border-zinc-700 text-zinc-600"
          }`}>
            {s.done && (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="w-2 h-px bg-zinc-700" />}
        </div>
      ))}
    </div>
  );
}

function DraftCard({ draft, onContinue, onDelete }: {
  draft: Draft;
  onContinue: (draft: Draft) => void;
  onDelete: (id: string) => void;
}) {
  const title = draft.hook || draft.idea || "Untitled draft";
  // Only 2 steps now
  const completedSteps = [draft.hook, draft.caption].filter(Boolean).length;

  return (
    <div className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            draft.status === "ready" ? "bg-emerald-500/10" : "bg-amber-500/10"
          }`}>
            {draft.status === "ready" ? (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-100 text-sm font-medium leading-snug line-clamp-2">{title}</p>
            {draft.idea && draft.hook && (
              <p className="text-zinc-500 text-xs mt-1 truncate">{draft.idea}</p>
            )}
            <StageBar hook={draft.hook} caption={draft.caption} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge status={draft.status} />
          <span className="text-zinc-600 text-xs">{timeAgo(draft.updated_at)}</span>
        </div>
      </div>

      {/* Caption preview */}
      {draft.caption && (
        <div className="mt-3 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
          <p className="text-zinc-400 text-xs line-clamp-2">{draft.caption}</p>
        </div>
      )}

      {/* Progress bar (Out of 2 steps) */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500"
            style={{ width: `${(completedSteps / 2) * 100}%` }}
          />
        </div>
        <span className="text-zinc-600 text-xs flex-shrink-0">{completedSteps}/2 steps</span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {draft.chat_id ? (
          <button
            type="button"
            onClick={() => onContinue(draft)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-xs font-semibold transition-all duration-150 shadow-md shadow-orange-500/20"
          >
            {draft.status === "ready" ? "View Post →" : "Continue →"}
          </button>
        ) : (
          <div className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => onDelete(draft.id)}
          className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 border border-zinc-700 hover:border-red-500/30 transition-all duration-150"
          title="Delete draft"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-zinc-800 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
        </div>
        <div className="h-6 w-14 bg-zinc-800 rounded-full animate-pulse" />
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full animate-pulse" />
    </div>
  );
}

export default function DraftsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const[filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("posts")
        // Removed hashtags from select
        .select("id, chat_id, idea_id, hook, caption, status, created_at, updated_at, ideas(idea)")
        .eq("user_id", user.id)
        .in("status",["draft", "ready", "idea"])
        .order("updated_at", { ascending: false });

      if (data) {
        setDrafts(data.map((d: any) => ({
          ...d,
          idea: d.ideas?.idea ?? null,
        })));
      }
      setLoading(false);
    };
    load();
  },[]);

  const handleDelete = async (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    await supabase.from("posts").delete().eq("id", id);
  };

  const handleContinue = (draft: Draft) => {
    if (draft.chat_id) navigate(`/chat/${draft.chat_id}`);
  };

  const filtered = drafts.filter((d) => {
    if (filter !== "all" && d.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (d.hook ?? "").toLowerCase().includes(q) ||
             (d.idea ?? "").toLowerCase().includes(q) ||
             (d.caption ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: drafts.length,
    draft: drafts.filter((d) => d.status === "draft").length,
    ready: drafts.filter((d) => d.status === "ready").length,
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Drafts</h1>
          <p className="text-slate-500 text-sm mt-1">Posts you're working on — pick up where you left off.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drafts…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
            />
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(["all", "draft", "ready"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  filter === f
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f} {counts[f] > 0 && <span className="ml-1 opacity-60">({counts[f]})</span>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">
              {search ? "No drafts match your search" : "No drafts yet"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? "Try a different search term" : "Start creating a post from the dashboard"}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all"
              >
                Go to Dashboard →
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onContinue={handleContinue}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}