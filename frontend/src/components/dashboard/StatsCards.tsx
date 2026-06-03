// src/components/dashboard/StatsCards.tsx
// Refactored V2: Standardized 3-column stats bar with inline "Start Streak" frequency modals.

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { API_BASE } from "../../lib/apiBase";

interface StatsCardsProps {
  postsThisMonth: number;
  ideasSaved: number;
  postStreak: number;
  loading: boolean;
  streakFrequency: string | null; // 🟢 Added
  onSaved?: () => void; // 🟢 Refresh callback after saving streak target
}

function streakMessage(streak: number): string {
  if (streak === 0) return "Post today to start your streak!";
  if (streak === 1) return "You posted today — keep it going!";
  if (streak < 5)   return `You're on a ${streak}-day roll. Don't stop now.`;
  if (streak < 10)  return `${streak} days in a row — one missing day = reach drop.`;
  if (streak < 20)  return `Don't break your ${streak}-day streak. Algorithms love consistency.`;
  return `${streak} days straight. You're built different.`;
}

function streakColor(streak: number): { bg: string; accent: string; ring: string; text: string } {
  if (streak === 0) return {
    bg: "bg-slate-50 dark:bg-white/[0.03]",
    accent: "text-slate-400 dark:text-slate-500",
    ring: "border-slate-100 dark:border-white/[0.06]",
    text: "text-slate-500 dark:text-slate-400"
  };
  if (streak < 5)   return {
    bg: "bg-amber-50 dark:bg-amber-500/[0.08]",
    accent: "text-amber-500",
    ring: "border-amber-100 dark:border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400"
  };
  if (streak < 10)  return {
    bg: "bg-orange-50 dark:bg-orange-500/[0.08]",
    accent: "text-orange-500",
    ring: "border-orange-100 dark:border-orange-500/20",
    text: "text-orange-700 dark:text-orange-400"
  };
  return {
    bg: "bg-red-50 dark:bg-red-500/[0.08]",
    accent: "text-red-500",
    ring: "border-red-100 dark:border-red-500/20",
    text: "text-red-700 dark:text-red-400"
  };
}

export default function StatsCards({ 
  postsThisMonth, 
  ideasSaved, 
  postStreak, 
  loading,
  streakFrequency,
  onSaved 
}: StatsCardsProps) {
  const colors = streakColor(postStreak);
  const message = streakMessage(postStreak);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── 🟢 DEBUG-ENABLED FRONTEND SAVE ──
  const handleSetFrequency = async (freq: string) => {
    console.log("1. handleSetFrequency trigger hua! Selected frequency:", freq);
    setSaving(true);
    try {
      console.log("2. Supabase se session fetch kar rahe hain...");
      const { data: { session } } = await supabase.auth.getSession();
      console.log("3. Session fetch ho gaya! Data:", session);

      const userId = session?.user?.id;
      if (!userId) {
        console.error("User session nahi mila!");
        throw new Error("No active user session found. Please re-login.");
      }

      console.log("4. Database 'user_profile' table ko update kar rahe hain, User ID:", userId);

      const { data, error } = await supabase
        .from("user_profile")
        .update({ streak_frequency: freq })
        .eq("id", userId)
        .select();
        
      console.log("5. Database response aaya! Data:", data, "Error:", error);
      if (error) throw error;

      if (!data || data.length === 0) {
        console.error("Database update toh hua par 0 rows impact huin! (RLS block or missing column)");
        throw new Error(
          "Update failed. 0 rows affected. Ensure you have run the ALTER TABLE SQL migration in Supabase to add the 'streak_frequency' column."
        );
      }

      console.log("6. Database update successful! Modal close ho raha hai aur page reload ho raha hai...");
      setShowModal(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error("❌ STREAK SAVE CRITICAL ERROR:", err);
      alert("Streak Save Error: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const FREQUENCY_OPTIONS = [
    { label: "🔥 2 Posts / Day", value: "2_day" },
    { label: "⚡ 1 Post / Day", value: "1_day" },
    { label: "📅 1 Post / 2 Days", value: "1_2days" },
    { label: "📅 1 Post / 3 Days", value: "1_3days" },
    { label: "📅 1 Post / 5 Days", value: "1_5days" },
    { label: "📅 1 Post / Week", value: "1_week" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-4 relative">

      {/* Posts this month */}
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-3 sm:p-5 flex flex-col gap-1.5 sm:gap-3 shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-shadow duration-200">
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} className="text-indigo-600 dark:text-indigo-400 sm:w-[18px] sm:h-[18px]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-6 w-10 sm:h-8 sm:w-14 bg-slate-100 dark:bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-3 w-16 sm:w-28 bg-slate-100 dark:bg-white/[0.06] rounded animate-pulse" />
          </div>
        ) : (
          <div>
            <div className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-1">
              {postsThisMonth}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold leading-tight">Posts this month</div>
          </div>
        )}
      </div>

      {/* Ideas saved */}
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-3 sm:p-5 flex flex-col gap-1.5 sm:gap-3 shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-shadow duration-200">
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} className="text-amber-500 sm:w-[18px] sm:h-[18px]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-6 w-10 sm:h-8 sm:w-14 bg-slate-100 dark:bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-3 w-16 sm:w-24 bg-slate-100 dark:bg-white/[0.06] rounded animate-pulse" />
          </div>
        ) : (
          <div>
            <div className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-1">
              {ideasSaved}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold leading-tight">Ideas saved</div>
          </div>
        )}
      </div>

      {/* Streak (🟢 V2 Start Streak Modal check added) */}
      <div className={`rounded-2xl border ${colors.ring} ${colors.bg} p-3 sm:p-5 flex flex-col justify-between shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-shadow duration-200`}>
        <div className="flex items-center justify-between mb-2">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/70 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm sm:text-lg">🔥</span>
          </div>
          {!loading && streakFrequency && postStreak > 0 && (
            <span className={`hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-white/60 dark:bg-white/[0.06] ${colors.accent}`}>
              Active streak
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-1.5 flex-1">
            <div className="h-6 w-10 sm:h-10 sm:w-20 bg-white/50 dark:bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-3 w-20 sm:w-36 bg-white/50 dark:bg-white/[0.06] rounded animate-pulse" />
          </div>
        ) : !streakFrequency ? (
          /* 🟢 CTA Overlay: If streak is not configured, show Start Streak button instead of 0 days! */
          <div className="flex-1 flex items-end">
            <button
              onClick={() => setShowModal(true)}
              className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-[10px] sm:text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all active:scale-95"
            >
              Start Streak 🚀
            </button>
          </div>
        ) : (
          /* Normal Streak display */
          <div>
            <div className={`text-xl sm:text-4xl font-bold tracking-tight leading-none mb-1 ${postStreak > 0 ? colors.accent : "text-slate-300 dark:text-slate-600"}`}>
              {postStreak}
              <span className="text-xs sm:text-base font-semibold ml-1 opacity-70">
                {postStreak === 1 ? "day" : "days"}
              </span>
            </div>
            <div className={`text-[10px] sm:text-xs font-semibold leading-snug ${colors.text}`}>
              <span className="sm:hidden">Active Streak</span>
              <span className="hidden sm:inline">{message}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 🟢 STREAK FREQUENCY CONFIGURATION MODAL OVERLAY ── */}
      {showModal && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowModal(false)}>
          <div 
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce">
              🔥
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Choose Posting Target</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Choose how frequently you plan to post Reels. Postra will automatically track your consistency based on this window!
              </p>
            </div>
            
            <div className="space-y-2 pt-2 text-left">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={saving}
                  onClick={() => handleSetFrequency(opt.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-zinc-850 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 border border-slate-150 dark:border-zinc-800 rounded-2xl text-left text-xs font-bold leading-normal text-slate-800 dark:text-zinc-200 transition-all flex justify-between items-center group"
                >
                  <span>{opt.label}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Choose →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}