// frontend/src/hooks/useChat.ts
// All state + async logic for the Chat page.
// The Chat page component stays purely presentational.
//
// Field mapping to real DB:
//   message.source     = 'user' | 'assistant'   (not role)
//   message.type       = 'text' | 'hooks' | 'captions' | 'hashtags'
//   message.metadata   = { hooks?, captions?, hashtags? }  (not payload)
//   stage              = derived by backend, returned on ChatDetail + saveSelection

import { useState, useCallback, useEffect, useRef } from "react";
import { getChat, sendMessage, saveSelection } from "../lib/chatApi";
import type { ChatMessage, ChatDetail, ChatStage } from "../lib/chatApi";

export interface UseChatState {
  chat:      ChatDetail | null;
  messages:  ChatMessage[];
  stage:     ChatStage;
  inputText: string;
  loading:   boolean;   // initial page load
  sending:   boolean;   // user sent a message, waiting for AI
  selecting: boolean;   // user clicked Select on a card
  error:     string | null;
}

const INITIAL: UseChatState = {
  chat:      null,
  messages:  [],
  stage:     "hooks",
  inputText: "",
  loading:   true,
  sending:   false,
  selecting: false,
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
    if (!text || state.sending || state.stage === "done") return;

    patch({ sending: true, error: null, inputText: "" });

    try {
      const { user_message, ai_message } = await sendMessage(chatId, text);
      setState((s) => ({
        ...s,
        messages: [...s.messages, user_message, ai_message],
        // if the AI message type advances the stage, update it
        stage: (ai_message.type === "hooks" || ai_message.type === "captions" || ai_message.type === "hashtags")
          ? ai_message.type
          : s.stage,
        sending: false,
      }));
    } catch (e: unknown) {
      patch({ sending: false, error: (e as Error).message });
    }
  }, [chatId, state.inputText, state.sending, state.stage]);

  // ── Select a hook ─────────────────────────────────────────────────────────
  const handleSelectHook = useCallback(
    async (hookText: string) => {
      if (!state.chat || state.selecting) return;
      patch({ selecting: true, error: null });

      try {
        const { stage, ai_message } = await saveSelection({
          chat_id: state.chat.id,
          hook: hookText,
        });
        setState((s) => ({
          ...s,
          messages: [...s.messages, ai_message],
          stage,
          selecting: false,
        }));
      } catch (e: unknown) {
        patch({ selecting: false, error: (e as Error).message });
      }
    },
    [state.chat, state.selecting]
  );

  // ── Select a caption ──────────────────────────────────────────────────────
  const handleSelectCaption = useCallback(
    async (captionText: string) => {
      if (!state.chat || state.selecting) return;
      patch({ selecting: true, error: null });

      try {
        const { stage, ai_message } = await saveSelection({
          chat_id: state.chat.id,
          caption: captionText,
        });
        setState((s) => ({
          ...s,
          messages: [...s.messages, ai_message],
          stage,
          selecting: false,
        }));
      } catch (e: unknown) {
        patch({ selecting: false, error: (e as Error).message });
      }
    },
    [state.chat, state.selecting]
  );

  // ── Select hashtags ───────────────────────────────────────────────────────
  const handleSelectHashtags = useCallback(
    async (tags: string[]) => {
      if (!state.chat || state.selecting) return;
      patch({ selecting: true, error: null });

      try {
        const { stage, ai_message } = await saveSelection({
          chat_id: state.chat.id,
          hashtags: tags,
        });
        setState((s) => ({
          ...s,
          messages: [...s.messages, ai_message],
          stage,
          selecting: false,
        }));
      } catch (e: unknown) {
        patch({ selecting: false, error: (e as Error).message });
      }
    },
    [state.chat, state.selecting]
  );

  return {
    state,
    bottomRef,
    setInputText,
    handleSend,
    handleSelectHook,
    handleSelectCaption,
    handleSelectHashtags,
  };
}