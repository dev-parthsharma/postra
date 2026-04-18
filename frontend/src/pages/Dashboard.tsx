// src/pages/Dashboard.tsx
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import StatsCards from "../components/dashboard/StatsCards";
import ContentCalendar from "../components/dashboard/ContentCalendar";
import TodayCTA from "../components/dashboard/TodayCTA";
import { useDashboard } from "../hooks/useDashboard";
import { useState } from "react";
import NewPostModal from "../components/NewPostModal";
import type { Chat } from "../lib/ideasApi";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getGreetingEmoji(hour: number): string {
  if (hour < 12) return "☀️";
  if (hour < 17) return "👋";
  return "🌙";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useDashboard();
  const [showNewPost, setShowNewPost] = useState(false);

  const hour = new Date().getHours();
  const greeting = getGreeting();
  const emoji = getGreetingEmoji(hour);

  const scheduledThisWeek = data?.scheduledThisWeek ?? 0;

  const handleChatCreated = (chat: Chat) => {
    setShowNewPost(false);
    navigate(`/chat/${chat.id}`);
  };

  return (
    <DashboardLayout>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting},{" "}
            {loading ? (
              <span className="inline-block w-24 h-8 bg-slate-100 dark:bg-white/[0.06] rounded-lg animate-pulse align-middle" />
            ) : (
              <span>{data?.userName ?? "Creator"}</span>
            )}{" "}
            <span>{emoji}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
            {loading ? (
              <span className="inline-block w-44 h-4 bg-slate-100 dark:bg-white/[0.06] rounded animate-pulse" />
            ) : scheduledThisWeek === 0 ? (
              "No posts scheduled this week — let's change that."
            ) : scheduledThisWeek === 1 ? (
              "You have 1 post scheduled this week."
            ) : (
              `You have ${scheduledThisWeek} posts scheduled this week.`
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewPost(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all duration-150 self-start sm:self-auto whitespace-nowrap"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Generate Idea
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-500/[0.08] border border-red-100 dark:border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-red-500 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Couldn't load some dashboard data. Please refresh.
          </p>
        </div>
      )}

      <StatsCards
        postsThisMonth={data?.postsThisMonth ?? 0}
        ideasSaved={data?.ideasSaved ?? 0}
        postStreak={data?.postStreak ?? 0}
        loading={loading}
      />

      <div className="mt-4">
        <TodayCTA
          cta={data?.todayCTA ?? { type: "none" }}
          loading={loading}
        />
      </div>

      <div className="mt-4">
        <ContentCalendar
          posts={data?.calendarPosts ?? []}
          loading={loading}
        />
      </div>

      {showNewPost && (
        <NewPostModal
          onClose={() => setShowNewPost(false)}
          onChatCreated={handleChatCreated}
        />
      )}
    </DashboardLayout>
  );
}