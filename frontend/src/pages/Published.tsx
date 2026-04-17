// frontend/src/pages/Published.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DashboardLayout from "../components/layout/DashboardLayout";

interface PublishedPost {
  id: string;
  chat_id: string | null;
  idea: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[] | null;
  posted_at: string | null;
  created_at: string;
}

function formatPostedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByMonth(posts: PublishedPost[]): Record<string, PublishedPost[]> {
  const groups: Record<string, PublishedPost[]> = {};
  for (const p of posts) {
    const d = new Date(p.posted_at || p.created_at);
    const key = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
}

function PostCard({ post, onView }: { post: PublishedPost; onView: (post: PublishedPost) => void }) {
  const [expanded, setExpanded] = useState(false);
  const dateStr = formatPostedDate(post.posted_at || post.created_at);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-50/60 border-b border-emerald-100/60">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-600">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-emerald-700">Published</span>
        </div>
        <span className="text-xs text-slate-400">{dateStr}</span>
      </div>

      <div className="p-4">
        {/* Hook / Idea */}
        <p className="text-slate-800 text-sm font-medium leading-snug line-clamp-2">
          {post.hook || post.idea || "Untitled post"}
        </p>

        {/* Caption */}
        {post.caption && (
          <div className="mt-3">
            <p className={`text-slate-500 text-xs leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
              {post.caption}
            </p>
            {post.caption.length > 160 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="text-indigo-500 text-xs mt-1 hover:underline"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.hashtags.slice(0, 6).map((tag) => (
              <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">
                {tag}
              </span>
            ))}
            {post.hashtags.length > 6 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">
                +{post.hashtags.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onView(post)}
            className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-100 hover:border-indigo-200 transition-all"
          >
            View post →
          </button>
          <button
            type="button"
            onClick={() => {
              const text = [post.hook, post.caption, post.hashtags?.join(" ")].filter(Boolean).join("\n\n");
              navigator.clipboard.writeText(text).catch(() => {});
            }}
            className="text-xs px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-slate-100 transition-all"
            title="Copy to clipboard"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="h-10 bg-emerald-50/60 border-b border-emerald-100/60 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-100 rounded animate-pulse" />
        <div className="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-slate-100 rounded animate-pulse w-3/5" />
      </div>
    </div>
  );
}

export default function PublishedPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("posts")
        .select("id, chat_id, idea, hook, caption, hashtags, posted_at, created_at")
        .eq("user_id", user.id)
        .eq("status", "published")
        .order("posted_at", { ascending: false, nullsFirst: false });

      if (data) {
        setPosts(data.map((d: any) => ({
          ...d,
          hashtags: Array.isArray(d.hashtags) ? d.hashtags : null,
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = posts.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.hook ?? "").toLowerCase().includes(q) ||
           (p.idea ?? "").toLowerCase().includes(q) ||
           (p.caption ?? "").toLowerCase().includes(q);
  });

  const groups = groupByMonth(filtered);

  // Stats
  const thisMonth = posts.filter((p) => {
    const d = new Date(p.posted_at || p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Published</h1>
              <p className="text-slate-500 text-sm mt-1">{posts.length} post{posts.length !== 1 ? "s" : ""} published total</p>
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-2xl font-bold text-emerald-600">{thisMonth}</div>
              <div className="text-xs text-slate-400">this month</div>
            </div>
          </div>

          {/* Mini stat strip */}
          {posts.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Total published", value: posts.length },
                { label: "This month", value: thisMonth },
                { label: "Avg / month", value: posts.length > 0 ? Math.round(posts.length / Math.max(1, Object.keys(groups).length)) : 0 },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm text-center">
                  <div className="text-lg font-bold text-slate-800">{s.value}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search published posts…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
          />
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">
              {search ? "No posts match your search" : "No published posts yet"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? "Try a different keyword" : "Finish a draft and mark it as published."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([month, monthPosts]) => (
              <div key={month}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{month}</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{monthPosts.length} post{monthPosts.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {monthPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onView={(p) => p.chat_id ? navigate(`/chat/${p.chat_id}`) : {}}
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