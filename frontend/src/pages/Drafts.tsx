// frontend/src/pages/Drafts.tsx
// Simplified V2: Direct post drafts viewer (No chats table dependence, clean content preview cards).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DashboardLayout from "../components/layout/DashboardLayout";

interface Draft {
  id: string;
  idea_id: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  status: "draft" | "ready" | "published";
  created_at: string;
  updated_at: string;
  idea?: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function DraftCard({ draft, onContinue, onDelete }: {
  draft: Draft;
  onContinue: (draft: Draft) => void;
  onDelete: (id: string) => void;
}) {
  const title = draft.hook || draft.idea || "Untitled draft";
  
  // Extract and clean script lines for card preview
  const scriptPreview = draft.script 
    ? draft.script.replace(/Hook:\s*[\s\S]*?Body:\s*/i, "").replace(/CTA:\s*[\s\S]*$/i, "").substring(0, 120).trim() + "..."
    : null;

  return (
    <div className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between h-full space-y-4">
      
      <div className="space-y-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <p className="text-zinc-100 text-sm font-semibold leading-snug line-clamp-2">{title}</p>
              <span className="text-zinc-600 text-[10px] uppercase font-bold tracking-wider mt-1 block">
                {timeAgo(draft.updated_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Script Content Preview Snippet */}
        {draft.script && (
          <div className="p-3 bg-zinc-850/40 rounded-xl border border-zinc-800/60 text-xs text-zinc-400 space-y-1">
            <span className="text-[9px] font-bold text-orange-400 dark:text-orange-500/70 uppercase tracking-wider block">Script Preview</span>
            <p className="line-clamp-2 leading-relaxed">{scriptPreview}</p>
          </div>
        )}

        {/* Caption Content Preview Snippet */}
        {draft.caption && (
          <div className="p-3 bg-zinc-850/40 rounded-xl border border-zinc-800/60 text-xs text-zinc-400 space-y-1">
            <span className="text-[9px] font-bold text-emerald-400 dark:text-emerald-500/70 uppercase tracking-wider block">Caption Preview</span>
            <p className="line-clamp-2 leading-relaxed">{draft.caption}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => onContinue(draft)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-xs font-semibold transition-all duration-150 shadow-md shadow-orange-500/20"
        >
          Open Editor & Preview →
        </button>
        <button
          type="button"
          onClick={() => onDelete(draft.id)}
          className="p-2.5 rounded-xl bg-zinc-800 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 border border-zinc-700 hover:border-red-500/30 transition-all duration-150"
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-zinc-800 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="h-12 bg-zinc-800 rounded-xl animate-pulse w-full" />
    </div>
  );
}

export default function DraftsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ── Safety delete state ──
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 🟢 V2 Fix: Removed chats(title) relationship to avoid db crash
      const { data } = await supabase
        .from("posts")
        .select("id, idea_id, hook, script, caption, status, created_at, updated_at, ideas(idea)")
        .eq("user_id", user.id)
        .eq("status", "draft") // Strictly load drafts waiting to be published
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
  }, []);

  // ── 🟢 SAFETY DELETE HANDLERS ──
  const handleDeleteTrigger = (id: string) => {
    setDeleteTargetId(id); // Open confirmation warning modal first
  };

  const confirmDelete = async (id: string) => {
    setDeleteTargetId(null);

    // Optimistic UI Update: Screen se turant disappear karo
    const previousDrafts = [...drafts];
    setDrafts((prev) => prev.filter((d) => d.id !== id));

    try {
      // 🟢 Added .select() to verify if rows were actually deleted
      const { data, error } = await supabase
        .from("posts")
        .delete()
        .eq("id", id)
        .select();
      
      if (error) throw error;

      // 🟢 Agar data length 0 hai, matlab RLS ne silently request ignore kar di
      if (!data || data.length === 0) {
        throw new Error(
          "Operation was silently blocked by database RLS. Ensure you have run the 'DELETE' RLS policy on the 'posts' table in Supabase."
        );
      }
    } catch (err: any) {
      // Deletion fail hone par rollback aur explicit alert
      setDrafts(previousDrafts);
      alert("Database Error: Failed to delete draft.\n\nReason: " + (err.message || err));
    }
  };

  const handleContinue = (draft: Draft) => {
    // Direct navigation using direct post ID (which bypasses old chat references)
    navigate(`/chat/${draft.id}`);
  };

  const filtered = drafts.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      return (d.hook ?? "").toLowerCase().includes(q) ||
             (d.idea ?? "").toLowerCase().includes(q) ||
             (d.caption ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Drafts</h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Posts you're working on — review and publish them to Instagram.</p>
        </div>

        <div className="mb-6">
          <div className="relative flex-1">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drafts…"
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-300 dark:text-zinc-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-zinc-400 font-medium">
              {search ? "No drafts match your search" : "No drafts yet"}
            </p>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-1">
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
                onDelete={handleDeleteTrigger} // 🟢 Calls safety trigger modal first
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 🟢 DELETE DOUBLE-CONFIRMATION POPUP OVERLAY ── */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Draft?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to delete this draft? This will permanently remove this post package and <span className="font-bold text-red-500">cannot be undone</span> [4].
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteTargetId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}