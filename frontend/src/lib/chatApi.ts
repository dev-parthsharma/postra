// frontend/src/lib/chatApi.ts
// Typed wrapper around the backend chat endpoints.
//
// Real DB schema:
//   messages: id, chat_id, sequence, content, source ('user'|'assistant'),
//             type ('text'), metadata (jsonb), created_at
//   chats:    id, idea_id, title, created_at, updated_at, user_id
//
// `stage` is derived by the backend from message history.

import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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

export type MessageSource = "user" | "assistant";
export type MessageType   = "text";

// Stage is now freeform — 'intro' | 'chatting'
export type ChatStage = string;

// Mirrors the messages table row exactly
export interface ChatMessage {
  id:         string;
  chat_id:    string;
  sequence:   number;
  content:    string;
  source:     MessageSource;
  type:       MessageType;
  metadata:   null;
  created_at: string;
}

// Mirrors the chats table + derived stage + joined messages[]
export interface ChatDetail {
  id:         string;
  user_id:    string;
  idea_id:    string;
  title:      string;
  stage:      ChatStage;
  created_at: string;
  updated_at: string;
  messages:   ChatMessage[];
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Load a chat and its full message history, ordered by sequence */
export async function getChat(chatId: string): Promise<ChatDetail> {
  const res = await fetch(`${BASE}/api/chat/${chatId}`, {
    headers: await authHeaders(),
  });
  return handleResponse<ChatDetail>(res);
}

/**
 * Send a user text message.
 * Backend saves it, calls AI, saves AI reply.
 * Returns both the saved user message and the AI reply.
 */
export async function sendMessage(
  chatId: string,
  content: string
): Promise<{ user_message: ChatMessage; ai_message: ChatMessage }> {
  const res = await fetch(`${BASE}/api/chat/${chatId}/message`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ content }),
  });
  return handleResponse<{ user_message: ChatMessage; ai_message: ChatMessage }>(res);
}

// Kept for legacy compatibility
export async function saveSelection(body: {
  chat_id: string;
  hook?: string;
  caption?: string;
  hashtags?: string[];
}): Promise<{ stage: ChatStage; ai_message: ChatMessage }> {
  const res = await fetch(`${BASE}/api/chat/select`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<{ stage: ChatStage; ai_message: ChatMessage }>(res);
}