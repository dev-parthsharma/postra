// frontend/src/lib/ideasApi.ts
// Thin typed wrapper around the backend ideas endpoints.
// All calls inject the Supabase session JWT automatically.

import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

// ── Custom error so callers can inspect the validation type ──────────────────

export class ApiError extends Error {
  type?: string;
  warning?: boolean;

  constructor(message: string, type?: string, warning?: boolean) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    this.warning = warning;
  }
}

// ── Response handler ──────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;

    if (detail && typeof detail === "object") {
      const msg: string = detail.message ?? detail.error ?? `Request failed: ${res.status}`;
      throw new ApiError(msg, detail.type);
    }

    throw new ApiError(
      typeof detail === "string" ? detail : `Request failed: ${res.status}`,
    );
  }

  const data = await res.json() as T & { warning?: boolean; type?: string; message?: string };

  if ((data as any).warning) {
    return data;
  }

  return data;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Idea {
  id: string;
  user_id: string;
  idea: string;
  source: "user" | "postra";
  is_favourite: boolean;
  created_at: string;
  updated_at: string;
  in_progress?: boolean;
  chat_id?: string | null;
  // Metadata fields (may be null for older ideas)
  why_it_works?: string | null;
  win_score?: number | null;
  // Present on CONFUSED saves
  warning?: boolean;
  type?: string;
  message?: string;
}

/** A single idea with full metadata — returned by generate endpoint */
export interface IdeaWithMeta extends Idea {
  why_it_works: string;
  win_score: number;
}

/** Structured response from /ideas/generate */
export interface GeneratedIdeasResult {
  recommended: IdeaWithMeta;
  alternatives: [IdeaWithMeta, IdeaWithMeta];
  /** True when Gemini was unavailable and fallback ideas were used */
  _fallback?: boolean;
}

export interface Chat {
  id: string;
  user_id: string;
  idea_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function generateIdeas(): Promise<GeneratedIdeasResult> {
  const res = await fetch(`${BASE}/api/ideas/generate`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return handleResponse<GeneratedIdeasResult>(res);
}

export async function saveUserIdea(idea: string): Promise<Idea> {
  const res = await fetch(`${BASE}/api/ideas/save`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ idea }),
  });
  const data = await handleResponse<{ idea: Idea; warning?: boolean; type?: string; message?: string }>(res);
  return {
    ...data.idea,
    warning: data.warning,
    type: data.type,
    message: data.message,
  };
}

export async function toggleFavourite(ideaId: string, isFavourite: boolean): Promise<Idea> {
  const res = await fetch(`${BASE}/api/ideas/favourite`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ idea_id: ideaId, is_favourite: isFavourite }),
  });
  const data = await handleResponse<{ idea: Idea }>(res);
  return data.idea;
}

export async function confirmIdea(ideaId: string, ideaText: string): Promise<Chat> {
  const res = await fetch(`${BASE}/api/ideas/confirm`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ idea_id: ideaId, idea_text: ideaText }),
  });
  const data = await handleResponse<{ chat: Chat }>(res);
  return data.chat;
}

export async function listIdeas(): Promise<Idea[]> {
  const res = await fetch(`${BASE}/api/ideas`, {
    headers: await authHeaders(),
  });
  const data = await handleResponse<{ ideas: Idea[] }>(res);
  return data.ideas;
}

export async function deleteIdea(ideaId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/ideas/${ideaId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  await handleResponse<void>(res);
}