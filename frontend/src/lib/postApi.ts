// frontend/src/lib/postApi.ts
// Cleaned API wrappers for direct post management (No chat/messaging endpoints).

import { supabase } from "./supabase";
import { API_BASE } from "./apiBase";

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostDetail {
  id:             string;
  chat_id:        string | null;
  idea_id:        string;
  hook:           string | null;
  script:         string | null;
  caption:        string | null;
  cover_image:    string | null;
  status:         string;
  editing_guide:  string | null;
  shooting_guide: string | null;
  user_id:        string;
  created_at:     string;
  updated_at:     string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Load a single generated post's metadata and content details */
export async function getPost(chatId: string): Promise<PostDetail> {
  // FastAPI backend uses get_chat currently, which serves the post details
  const res = await fetch(`${API_BASE}/api/chat/${chatId}`, {
    headers: await authHeaders(),
  });
  return handleResponse<PostDetail>(res);
}

/** Save manual edits to a post's hook, caption, or script */
export async function saveSelection(body: {
  chat_id: string;
  hook?: string;
  caption?: string;
  script?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/chat/select`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<any>(res);
}

/** Ask AI to edit/refine a script with a prompt */
export async function editScriptWithAI(
  chatId: string, 
  currentScript: string, 
  prompt: string
): Promise<{ updated_script: string }> {
  const res = await fetch(`${API_BASE}/api/chat/${chatId}/edit-script`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ current_script: currentScript, prompt }),
  });
  return handleResponse<{ updated_script: string }>(res);
}

/** Unlock script API (premium features) */
export async function unlockScriptApi(chatId: string): Promise<{ script: string }> {
  const res = await fetch(`${API_BASE}/api/chat/${chatId}/unlock-script`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return handleResponse<{ script: string }>(res);
}

export async function generateSingleField(chatId: string, fieldName: string): Promise<{ generated_text: string }> {
  const res = await fetch(`${API_BASE}/api/chat/${chatId}/generate-field`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ field_name: fieldName }),
  });
  return handleResponse<{ generated_text: string }>(res);
}