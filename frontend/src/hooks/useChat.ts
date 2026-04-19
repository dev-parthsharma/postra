// frontend/src/hooks/useChat.ts
// Simplified chat hook — just load, send message, scroll.
// No forced hook/caption/hashtag selection flow.

import { useState, useCallback, useEffect, useRef } from "react";
import { getChat, sendMessage } from "../lib/chatApi";
import type { ChatMessage, ChatDetail } from "../lib/chatApi";

export interface UseChatState {
  chat:      ChatDetail | null;
  messages:  ChatMessage[];
  stage:     string;
  inputText: string;
  loading:   boolean;
  sending:   boolean;
  error:     string | null;
}

const INITIAL: UseChatState = {
  chat:      null,
  messages:  [],
  stage:     "intro",
  inputText: "",
  loading:   true,
  sending:   false,
  error:     null,
};

export function useChat(chatId: string) {
  const [state, setState] = useState<UseChatState>(INITIAL);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const patch = (partial: Partial<UseChatState>) =>
    setState((s) => ({ ...s, ...partial }));

  // ── Scroll to bottom whenever messages change ─────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // ── Load chat on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;

    const load = async () => {
      patch({ loading: true, error: null });
      try {
        const chat = await getChat(chatId);
        if (cancelled) return;
        patch({
          chat,
          messages: chat.messages,
          stage: chat.stage,
          loading: false,
        });
      } catch (e: unknown) {
        if (cancelled) return;
        patch({ loading: false, error: (e as Error).message });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [chatId]);

  // ── Set input text ────────────────────────────────────────────────────────
  const setInputText = useCallback((text: string) => {
    patch({ inputText: text, error: null });
  }, []);

  // ── Send a user message ───────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = state.inputText.trim();
    if (!text || state.sending) return;

    patch({ sending: true, error: null, inputText: "" });

    try {
      const { user_message, ai_message } = await sendMessage(chatId, text);
      setState((s) => ({
        ...s,
        messages: [...s.messages, user_message, ai_message],
        stage: "chatting",
        sending: false,
      }));
    } catch (e: unknown) {
      patch({ sending: false, error: (e as Error).message });
    }
  }, [chatId, state.inputText, state.sending]);

  return {
    state,
    bottomRef,
    setInputText,
    handleSend,
  };
}