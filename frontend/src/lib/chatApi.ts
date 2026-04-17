// frontend/src/lib/chatApi.ts
// Typed wrapper around the backend chat endpoints.
// Follows the same pattern as ideasApi.ts.
//
// Real DB schema:
//   messages: id, chat_id, sequence, content, source ('user'|'assistant'),
//             type ('text'|'hooks'|'captions'|'hashtags'), metadata (jsonb), created_at
//   chats:    id, idea_id, title, created_at, updated_at, user_id  (no stage column)
//   posts:    id, chat_id, idea, hook, caption, hashtags (jsonb), status, user_id, ...
//
// `stage` is derived by the backend from the message history, not stored on chats.

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
export type MessageType   = "text" | "hooks" | "captions" | "hashtags";

// Derived by backend from message history — not a real DB column on chats
export type ChatStage = "hooks" | "captions" | "hashtags" | "done";

export interface Hook {
  id: string;    // e.g. "hook_1"
  style: string; // e.g. "Bold", "Question", "Story"
  text: string;
}

export interface Caption {
  id: string;     // e.g. "caption_short"
  length: string; // e.g. "Short", "Medium", "Long"
  text: string;
}

export interface Hashtag {
  tag: string; // e.g. "#fitness"
}

// Stored in messages.metadata (jsonb) — only one key populated per message
export interface MessageMetadata {
  hooks?:    Hook[];
  captions?: Caption[];
  hashtags?: Hashtag[];
}

// Mirrors the messages table row exactly
export interface ChatMessage {
  id:         string;
  chat_id:    string;
  sequence:   number;
  content:    string;
  source:     MessageSource;        // 'user' | 'assistant'
  type:       MessageType;          // 'text' | 'hooks' | 'captions' | 'hashtags'
  metadata:   MessageMetadata | null;
  created_at: string;
}

// Mirrors the chats table + derived stage + joined messages[]
export interface ChatDetail {
  id:         string;
  user_id:    string;
  idea_id:    string;
  title:      string;
  stage:      ChatStage; // computed by backend, not stored
  created_at: string;
  updated_at: string;
  messages:   ChatMessage[];
}

export interface SaveSelectionRequest {
  chat_id:   string;
  hook?:     string;
  caption?:  string;
  hashtags?: string[]; // e.g. ["#fitness", "#reels"]
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
 * Backend saves it, calls AI, saves AI reply with correct type + metadata.
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

/**
 * Called when user selects a hook, caption, or finalises hashtags.
 * Backend saves selection to posts table, generates next AI message.
 * Returns the updated derived stage and the next AI message.
 */
export async function saveSelection(
  body: SaveSelectionRequest
): Promise<{ stage: ChatStage; ai_message: ChatMessage }> {
  const res = await fetch(`${BASE}/api/chat/select`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<{ stage: ChatStage; ai_message: ChatMessage }>(res);
}