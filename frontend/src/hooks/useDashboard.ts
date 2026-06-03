// frontend/src/hooks/useDashboard.ts
// Cleaned V2 Dashboard hook: Decoupled from chats table & favorites. Queries direct planned date idea for today.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface DraftPost {
  id: string;
  idea: string;
  status: "draft" | "idea" | "scheduled" | "published";
  updated_at: string;
  hook: string | null;
  script: string | null;
}

export interface CalendarPost {
  id: string;
  title: string;          
  scheduled_at: string;   
  status: "scheduled" | "published";
}

export interface SavedIdea {
  id: string;
  idea: string;
}

export type TodayCTA =
  | { type: "scheduled_idea"; idea: SavedIdea } // Planned idea of today
  | { type: "draft"; draft: DraftPost }
  | { type: "idea"; idea: SavedIdea }
  | { type: "mindset" }; // Comfort Mindset Vibe check

export interface DashboardData {
  userName: string;
  postsThisMonth: number;
  ideasSaved: number;
  scheduledThisWeek: number;
  postStreak: number;        
  streakFrequency: string | null; // Added
  calendarPosts: CalendarPost[];
  todayCTA: TodayCTA;
}

export function useDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const calendarStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const calendarEnd   = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

        // Calculate Today's Local Date safely to match database DATE format
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const [
          profileRes,
          postsMonthRes,
          ideasRes,
          scheduledWeekRes,
          userStatsRes,
          scheduledCalRes,
          publishedCalRes,
          oldestDraftRes,
          savedIdeasRes,
          todayScheduledIdeaRes, 
        ] = await Promise.all([
          // 1. Profile (🟢 FIXED: Removed non-existent 'last_posted_date' column from select)
          supabase.from("user_profile").select("name, streak_frequency").eq("id", user!.id).single(),
          // 2. Posts this month
          supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user!.id).gte("created_at", startOfMonth),
          // 3. Ideas saved
          supabase.from("ideas").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
          // 4. Scheduled this week
          supabase.from("schedules").select("id, posts!inner ( user_id )", { count: "exact", head: true }).eq("posts.user_id", user!.id).eq("status", "scheduled").gte("scheduled_at", startOfWeek.toISOString()).lte("scheduled_at", endOfWeek.toISOString()),
          
          // 5. Real-Time Streak Fetch
          supabase.from("user_stats").select("streak_count, stat_date").eq("user_id", user!.id).order("stat_date", { ascending: false }).limit(1),
          
          // 6. Calendar & Drafts
          supabase.from("schedules").select(`id, scheduled_at, status, posts!inner ( id, user_id, ideas ( idea ) )`).eq("posts.user_id", user!.id).in("status", ["scheduled"]).gte("scheduled_at", calendarStart).lte("scheduled_at", calendarEnd).order("scheduled_at", { ascending: true }),
          supabase.from("posts").select("id, created_at, ideas ( idea )").eq("user_id", user!.id).eq("status", "published").gte("created_at", calendarStart).lte("created_at", calendarEnd).order("created_at", { ascending: true }),
          supabase.from("posts").select("id, hook, script, status, updated_at, ideas ( idea )").eq("user_id", user!.id).in("status", ["draft", "ready"]).order("created_at", { ascending: true }).limit(1),
          
          supabase.from("ideas").select("id, idea").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(1),
          
          // 7. V2: Today's idea select query updated to fetch direct child post.id from posts table
          supabase.from("ideas").select("id, idea, posts(id)").eq("user_id", user!.id).eq("scheduled_date", todayStr).maybeSingle(),
        ]);

        const userName = profileRes.data?.name || user!.email?.split("@")[0] || "Creator";
        const postsThisMonth = postsMonthRes.count ?? 0;
        const ideasSaved = ideasRes.count ?? 0;
        const scheduledThisWeek = scheduledWeekRes.count ?? 0;

        // 🟢 FIXED: Type casted 'profileRes.data' to 'any' to bypass missing property check
        const profileData: any = profileRes.data;
        const streakFrequency = profileData?.streak_frequency || null;

        // 🟢 FIXED: Type casted 'userStatsRes.data' row to 'any' to bypass missing stat_date check
        const latestStatsRow: any = userStatsRes.data?.[0];
        const lastPosted = latestStatsRow?.stat_date;
        let postStreak = latestStatsRow?.streak_count || 0;

        // REAL-TIME STREAK BREAK gap check
        if (streakFrequency && lastPosted) {
          const limits: Record<string, number> = {
            "2_day": 1,
            "1_day": 1,
            "1_2days": 2,
            "1_3days": 3,
            "1_5days": 5,
            "1_week": 7
          };
          const maxGap = limits[streakFrequency] || 1;
          const todayDate = new Date(todayStr).getTime();
          const lastPostedDate = new Date(lastPosted).getTime();
          const gapDays = Math.floor((todayDate - lastPostedDate) / (1000 * 60 * 60 * 24));
          
          if (gapDays > maxGap) {
            postStreak = 0; // Streak broken in real-time
          }
        } else {
          postStreak = 0; // No active streak configured yet
        }

        const calendarPosts: CalendarPost[] = [
          ...(scheduledCalRes.data ?? []).map((s: any) => {
            const ideaText = Array.isArray(s.posts?.ideas) ? s.posts?.ideas[0]?.idea : s.posts?.ideas?.idea;
            return {
              id: s.id,
              title: (ideaText ?? "Scheduled post").slice(0, 60),
              scheduled_at: s.scheduled_at,
              status: "scheduled" as const,
            };
          }),
          ...(publishedCalRes.data ?? []).map((p: any) => {
            const ideaText = Array.isArray(p.ideas) ? p.ideas[0]?.idea : p.ideas?.idea;
            return {
              id: p.id,
              title: (ideaText ?? "Published post").slice(0, 60),
              scheduled_at: p.created_at,
              status: "published" as const,
            };
          }),
        ].sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1));

        let todayCTA: TodayCTA = { type: "mindset" }; 
        const todayScheduledIdea: any = todayScheduledIdeaRes.data;

        // Check if today's scheduled idea has a post generated
        const todayPosts = todayScheduledIdea?.posts;
        const todayIdeaHasPost = Array.isArray(todayPosts) ? todayPosts.length > 0 : !!todayPosts;

        // ── PRIORITY-BASED DECISION LOGIC ──
        if (todayScheduledIdea && !todayIdeaHasPost) {
          // 🚀 PRIORITY 1: Today's Planned Idea (Only if no post has been generated yet!)
          todayCTA = {
            type: "scheduled_idea",
            idea: {
              id: todayScheduledIdea.id,
              idea: todayScheduledIdea.idea,
            }
          };
        } else {
          const hadScheduledIdeaToday = !!todayScheduledIdea;
          
          if (hadScheduledIdeaToday && todayIdeaHasPost) {
            // Reward State: Aaj ka scheduled task poora hua -> Show randomized Comfort/Mindset Card!
            todayCTA = { type: "mindset" };
          } else if (oldestDraftRes.data?.[0]) {
            // 📝 PRIORITY 2: Unfinished Draft Post from backlog (If no active today tasks)
            const oldestDraft: any = oldestDraftRes.data[0];
            const ideaText = Array.isArray(oldestDraft.ideas) ? oldestDraft.ideas[0]?.idea : oldestDraft.ideas?.idea;
            todayCTA = {
              type: "draft",
              draft: {
                id: oldestDraft.id,
                idea: ideaText || "Draft post",
                hook: oldestDraft.hook,
                script: oldestDraft.script,
                status: oldestDraft.status,
                updated_at: oldestDraft.updated_at,
              },
            };
          } else if (savedIdeasRes.data?.[0]) {
            // 💡 PRIORITY 3: Unscheduled Saved Idea
            const savedIdea: any = savedIdeasRes.data[0];
            todayCTA = {
              type: "idea",
              idea: {
                id: savedIdea.id,
                idea: savedIdea.idea,
              },
            };
          }
        }

        setData({ userName, postsThisMonth, ideasSaved, scheduledThisWeek, postStreak, streakFrequency, calendarPosts, todayCTA });
      } catch (err: any) {
        setError(err.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [user]);

  return { data, loading, error };
}