// frontend/src/hooks/useDashboard.ts
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

export interface DashboardData {
  userName: string;
  postsThisMonth: number;
  savedWorkflows: number; // always 0 for now
  ideasSaved: number;
  scheduledThisWeek: number;
  recentDrafts: DraftPost[];
  scheduledPosts: ScheduledPost[];
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

        const [
          profileRes,
          postsMonthRes,
          ideasRes,
          recentDraftsRes,
          scheduledPostsRes,
          scheduledWeekRes,
        ] = await Promise.all([

          // 1. User name from user_profile
          supabase
            .from("user_profile")
            .select("name")
            .eq("id", user!.id)
            .single(),

          // 2. Posts this month — direct user_id
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .gte("created_at", startOfMonth),

          // 3. Ideas saved count — direct user_id
          supabase
            .from("ideas")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id),

          // 4. Recent drafts — last 4, not published — direct user_id
          supabase
            .from("posts")
            .select("id, idea, hook, script, status, updated_at")
            .eq("user_id", user!.id)
            .in("status", ["draft", "idea", "scheduled"])
            .order("updated_at", { ascending: false })
            .limit(4),

          // 5. Upcoming scheduled posts
          //    schedules.post_id → posts.id, posts has user_id
          supabase
            .from("schedules")
            .select(`
              id,
              post_id,
              scheduled_at,
              status,
              posts!inner ( idea, hook, user_id )
            `)
            .eq("posts.user_id", user!.id)
            .eq("status", "scheduled")
            .gte("scheduled_at", now.toISOString())
            .order("scheduled_at", { ascending: true })
            .limit(3),

          // 6. Scheduled this week count
          supabase
            .from("schedules")
            .select("id, posts!inner ( user_id )", { count: "exact", head: true })
            .eq("posts.user_id", user!.id)
            .eq("status", "scheduled")
            .gte("scheduled_at", startOfWeek.toISOString())
            .lte("scheduled_at", endOfWeek.toISOString()),
        ]);

        // ── Assemble ──────────────────────────────────────────────────────────
        const userName =
          profileRes.data?.name ||
          user!.email?.split("@")[0] ||
          "Creator";

        const postsThisMonth = postsMonthRes.count ?? 0;
        const ideasSaved = ideasRes.count ?? 0;
        const scheduledThisWeek = scheduledWeekRes.count ?? 0;

        const recentDrafts: DraftPost[] = (recentDraftsRes.data ?? []).map(
          (p: any) => ({
            id: p.id,
            idea: p.idea,
            hook: p.hook,
            script: p.script,
            status: p.status,
            updated_at: p.updated_at,
          })
        );

        const scheduledPosts: ScheduledPost[] = (scheduledPostsRes.data ?? []).map(
          (s: any) => ({
            id: s.id,
            post_id: s.post_id,
            scheduled_at: s.scheduled_at,
            status: s.status,
            post: s.posts
              ? { idea: s.posts.idea, hook: s.posts.hook }
              : null,
          })
        );

        setData({
          userName,
          postsThisMonth,
          savedWorkflows: 0,
          ideasSaved,
          scheduledThisWeek,
          recentDrafts,
          scheduledPosts,
        });
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