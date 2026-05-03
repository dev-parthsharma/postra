// frontend/src/hooks/useDashboard.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface DraftPost {
  id: string;
  chat_id?: string | null;
  idea: string;
  status: "draft" | "idea" | "scheduled" | "published";
  updated_at: string;
  hook: string | null;
  script: string | null;
}

export interface ScheduledPost {
  id: string;
  post_id: string;
  scheduled_at: string;
  status: string;
  post: {
    idea: string;
    hook: string | null;
  } | null;
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
  is_favourite: boolean;
  chat_id: string | null;  
}

export type TodayCTA =
  | { type: "draft"; draft: DraftPost }
  | { type: "idea"; idea: SavedIdea }
  | { type: "none" };

export interface DashboardData {
  userName: string;
  postsThisMonth: number;
  ideasSaved: number;
  scheduledThisWeek: number;
  postStreak: number;        
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

        const[
          profileRes,
          postsMonthRes,
          ideasRes,
          scheduledWeekRes,
          userStatsRes, // 🟢 NAYA STREAK QUERY RESULT
          scheduledCalRes,
          publishedCalRes,
          oldestDraftRes,
          savedIdeasRes,
        ] = await Promise.all([
          // 1. Profile
          supabase.from("user_profile").select("name").eq("id", user!.id).single(),
          // 2. Posts this month
          supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user!.id).gte("created_at", startOfMonth),
          // 3. Ideas saved
          supabase.from("ideas").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
          // 4. Scheduled this week
          supabase.from("schedules").select("id, posts!inner ( user_id )", { count: "exact", head: true }).eq("posts.user_id", user!.id).eq("status", "scheduled").gte("scheduled_at", startOfWeek.toISOString()).lte("scheduled_at", endOfWeek.toISOString()),
          
          // 5. 🟢 REAL-TIME STREAK FETCH (Database se)
          supabase.from("user_stats").select("streak_count").eq("user_id", user!.id).order("stat_date", { ascending: false }).limit(1),
          
          // 6. Calendar & Drafts
          supabase.from("schedules").select(`id, scheduled_at, status, posts!inner ( id, user_id, ideas ( idea ) )`).eq("posts.user_id", user!.id).in("status",["scheduled"]).gte("scheduled_at", calendarStart).lte("scheduled_at", calendarEnd).order("scheduled_at", { ascending: true }),
          supabase.from("posts").select("id, created_at, ideas ( idea )").eq("user_id", user!.id).eq("status", "published").gte("created_at", calendarStart).lte("created_at", calendarEnd).order("created_at", { ascending: true }),
          supabase.from("posts").select("id, hook, script, status, updated_at, chat_id, ideas ( idea )").eq("user_id", user!.id).in("status",["draft", "idea"]).order("created_at", { ascending: true }).limit(1),
          supabase.from("ideas").select("id, idea, is_favourite, chats(id)").eq("user_id", user!.id).or("is_favourite.eq.true,source.eq.user").order("is_favourite", { ascending: false }).limit(1),
        ]);

        const userName = profileRes.data?.name || user!.email?.split("@")[0] || "Creator";
        const postsThisMonth = postsMonthRes.count ?? 0;
        const ideasSaved = ideasRes.count ?? 0;
        const scheduledThisWeek = scheduledWeekRes.count ?? 0;

        // 🟢 ASSIGNING THE NEW STREAK
        const postStreak = userStatsRes.data?.[0]?.streak_count || 0;

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
          ...(publishedCalRes.data ??[]).map((p: any) => {
            const ideaText = Array.isArray(p.ideas) ? p.ideas[0]?.idea : p.ideas?.idea;
            return {
              id: p.id,
              title: (ideaText ?? "Published post").slice(0, 60),
              scheduled_at: p.created_at,
              status: "published" as const,
            };
          }),
        ].sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1));

        let todayCTA: TodayCTA = { type: "none" };
        const oldestDraft: any = oldestDraftRes.data?.[0];
        
        if (oldestDraft) {
          const ideaText = Array.isArray(oldestDraft.ideas) ? oldestDraft.ideas[0]?.idea : oldestDraft.ideas?.idea;
          todayCTA = {
            type: "draft",
            draft: {
              id: oldestDraft.id,
              chat_id: oldestDraft.chat_id ?? null,
              idea: ideaText || "Draft post",
              hook: oldestDraft.hook,
              script: oldestDraft.script,
              status: oldestDraft.status,
              updated_at: oldestDraft.updated_at,
            },
          };
        } else {
          const savedIdea: any = savedIdeasRes.data?.[0];
          if (savedIdea) {
            const chatEntry = Array.isArray(savedIdea.chats) ? savedIdea.chats[0] : savedIdea.chats;
            todayCTA = {
              type: "idea",
              idea: {
                id: savedIdea.id,
                idea: savedIdea.idea,
                is_favourite: savedIdea.is_favourite,
                chat_id: chatEntry?.id ?? null,   
              },
            };
          }
        }

        setData({ userName, postsThisMonth, ideasSaved, scheduledThisWeek, postStreak, calendarPosts, todayCTA });
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