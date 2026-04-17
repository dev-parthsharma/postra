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
  title: string;          // idea text (truncated)
  scheduled_at: string;   // ISO string
  status: "scheduled" | "published";
}

export interface SavedIdea {
  id: string;
  idea: string;
  is_favourite: boolean;
  chat_id: string | null;  // ← added: so CTA can link directly to chat
}

// CTA = "Post for Today"
export type TodayCTA =
  | { type: "draft"; draft: DraftPost }
  | { type: "idea"; idea: SavedIdea }
  | { type: "none" };

export interface DashboardData {
  userName: string;
  postsThisMonth: number;
  ideasSaved: number;
  scheduledThisWeek: number;
  postStreak: number;        // consecutive days with a published post (ending today)
  calendarPosts: CalendarPost[];
  todayCTA: TodayCTA;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function computeStreak(publishedDates: string[]): number {
  if (!publishedDates.length) return 0;

  // Unique calendar days (YYYY-MM-DD) sorted descending
  const days = Array.from(
    new Set(publishedDates.map((d) => d.slice(0, 10)))
  ).sort((a, b) => (a > b ? -1 : 1));

  const today = localDateStr(new Date());
  // streak must include today or yesterday (grace for same-day check)
  if (days[0] !== today && days[0] !== getPrevDay(today)) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === getPrevDay(days[i - 1])) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getPrevDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

/** Returns YYYY-MM-DD in LOCAL time (not UTC) to avoid timezone shift bugs */
export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── hook ───────────────────────────────────────────────────────────────────────

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

        // week bounds for scheduled count
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // calendar: fetch 3 months of scheduled+published posts
        const calendarStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const calendarEnd   = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

        // streak: all published posts (we only need created_at dates)
        const streakLookback = new Date(now);
        streakLookback.setDate(now.getDate() - 90); // 90-day window is plenty

        const [
          profileRes,
          postsMonthRes,
          ideasRes,
          scheduledWeekRes,
          publishedForStreakRes,
          scheduledCalRes,
          publishedCalRes,
          oldestDraftRes,
          savedIdeasRes,
        ] = await Promise.all([

          // 1. profile
          supabase
            .from("user_profile")
            .select("name")
            .eq("id", user!.id)
            .single(),

          // 2. posts this month
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .gte("created_at", startOfMonth),

          // 3. ideas saved count
          supabase
            .from("ideas")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id),

          // 4. scheduled this week count
          supabase
            .from("schedules")
            .select("id, posts!inner ( user_id )", { count: "exact", head: true })
            .eq("posts.user_id", user!.id)
            .eq("status", "scheduled")
            .gte("scheduled_at", startOfWeek.toISOString())
            .lte("scheduled_at", endOfWeek.toISOString()),

          // 5. published posts for streak calc (just dates)
          supabase
            .from("posts")
            .select("created_at")
            .eq("user_id", user!.id)
            .eq("status", "published")
            .gte("created_at", streakLookback.toISOString()),

          // 6. calendar: scheduled posts with schedule date
          supabase
            .from("schedules")
            .select(`id, scheduled_at, status, posts!inner ( id, idea, user_id )`)
            .eq("posts.user_id", user!.id)
            .in("status", ["scheduled"])
            .gte("scheduled_at", calendarStart)
            .lte("scheduled_at", calendarEnd)
            .order("scheduled_at", { ascending: true }),

          // 7. calendar: published posts (use created_at as the date)
          supabase
            .from("posts")
            .select("id, idea, created_at")
            .eq("user_id", user!.id)
            .eq("status", "published")
            .gte("created_at", calendarStart)
            .lte("created_at", calendarEnd)
            .order("created_at", { ascending: true }),

          // 8. oldest unfinished draft for CTA (has chat, not published)
          supabase
            .from("posts")
            .select("id, idea, hook, script, status, updated_at, chat_id")
            .eq("user_id", user!.id)
            .in("status", ["draft", "idea"])
            .order("created_at", { ascending: true })   // oldest first
            .limit(1),

          // 9. saved / favourite ideas for CTA fallback
          // ← also join chats so we know if a chat already exists for this idea
          supabase
            .from("ideas")
            .select("id, idea, is_favourite, chats(id)")
            .eq("user_id", user!.id)
            .or("is_favourite.eq.true,source.eq.user")
            .order("is_favourite", { ascending: false })
            .limit(1),
        ]);

        // ── assemble ──────────────────────────────────────────────────────────

        const userName =
          profileRes.data?.name ||
          user!.email?.split("@")[0] ||
          "Creator";

        const postsThisMonth   = postsMonthRes.count ?? 0;
        const ideasSaved       = ideasRes.count ?? 0;
        const scheduledThisWeek = scheduledWeekRes.count ?? 0;

        // streak
        const publishedDates: string[] = (publishedForStreakRes.data ?? []).map(
          (p: any) => p.created_at as string
        );
        const postStreak = computeStreak(publishedDates);

        // calendar posts
        const calendarPosts: CalendarPost[] = [
          ...(scheduledCalRes.data ?? []).map((s: any) => ({
            id: s.id,
            title: (s.posts?.idea ?? "Scheduled post").slice(0, 60),
            scheduled_at: s.scheduled_at,
            status: "scheduled" as const,
          })),
          ...(publishedCalRes.data ?? []).map((p: any) => ({
            id: p.id,
            title: (p.idea ?? "Published post").slice(0, 60),
            scheduled_at: p.created_at,
            status: "published" as const,
          })),
        ].sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1));

        // today CTA logic
        let todayCTA: TodayCTA = { type: "none" };
        const oldestDraft = oldestDraftRes.data?.[0];
        if (oldestDraft) {
          todayCTA = {
            type: "draft",
            draft: {
              id: oldestDraft.id,
              chat_id: oldestDraft.chat_id ?? null,
              idea: oldestDraft.idea,
              hook: oldestDraft.hook,
              script: oldestDraft.script,
              status: oldestDraft.status,
              updated_at: oldestDraft.updated_at,
            },
          };
        } else {
          const savedIdea = savedIdeasRes.data?.[0];
          if (savedIdea) {
            // chats join can be an array or single object — normalise it
            const chatEntry = Array.isArray(savedIdea.chats)
              ? savedIdea.chats[0]
              : savedIdea.chats;
            const chatId = chatEntry?.id ?? null;

            todayCTA = {
              type: "idea",
              idea: {
                id: savedIdea.id,
                idea: savedIdea.idea,
                is_favourite: savedIdea.is_favourite,
                chat_id: chatId,   // ← now properly populated
              },
            };
          }
        }

        setData({
          userName,
          postsThisMonth,
          ideasSaved,
          scheduledThisWeek,
          postStreak,
          calendarPosts,
          todayCTA,
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