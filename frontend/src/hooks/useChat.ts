// frontend/src/hooks/useChat.ts
// Simplified chat hook — just load, send message, scroll.
// No forced hook/caption/hashtag selection flow.

import { useState, useCallback, useEffect, useRef } from "react";
import { getChat, sendMessage, saveSelection } from "../lib/chatApi"; // added saveSelection
import type { ChatMessage, ChatDetail } from "../lib/chatApi";

export interface UseChatState {
  chat: ChatDetail | null;
  messages: ChatMessage[];
  stage: string;
  inputText: string;
  loading: boolean;
  sending: boolean;
  error: string | null;
}

const INITIAL: UseChatState = { chat: null, messages:[], stage: "intro", inputText: "", loading: true, sending: false, error: null };

export function useChat(chatId: string) {
  const[state, setState] = useState<UseChatState>(INITIAL);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const patch = (partial: Partial<UseChatState>) => setState((s) => ({ ...s, ...partial }));

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); },[state.messages, state.sending]);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    const load = async () => {
      patch({ loading: true, error: null });
      try {
        const chat = await getChat(chatId);
        if (cancelled) return;
        patch({ chat, messages: chat.messages, stage: chat.stage, loading: false });
      } catch (e: unknown) {
        if (cancelled) return;
        patch({ loading: false, error: (e as Error).message });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [chatId]);

  const setInputText = useCallback((text: string) => { patch({ inputText: text, error: null }); },[]);

  // OPTIMISTIC UI + INTENT ROUTING
  const handleSend = useCallback(async (overrideText?: string, explicitIntent?: string) => {
    const text = (overrideText || state.inputText).trim();
    if (!text || state.sending) return { success: false };

    // 1. Optimistic Update (Turant UI pe dikhane ke liye)
    const tempId = `temp-${Date.now()}`;
    const tempUserMsg: ChatMessage = {
      id: tempId, chat_id: chatId, sequence: 9999, content: text, source: "user", type: "text", metadata: null, created_at: new Date().toISOString()
    };

    setState((s) => ({ ...s, sending: true, error: null, inputText: "", messages: [...s.messages, tempUserMsg] }));

    try {
      // 2. Network Call
      const { user_message, ai_message } = await sendMessage(chatId, text, explicitIntent);
      
      // 3. Replace temp with real
      setState((s) => ({
        ...s,
        messages:[...s.messages.filter(m => m.id !== tempId), user_message, ai_message],
        stage: "chatting",
        sending: false,
      }));
      return { success: true };
      
    } catch (e: any) {
      // API FAILS: Sabse pehle user ka fake message UI se hatao
      setState((s) => ({ ...s, sending: false, messages: s.messages.filter(m => m.id !== tempId) }));
      
      if (e.message?.includes("HOOK_LIMIT_REACHED")) {
        return { success: false, limitReached: "hook" };
      }
      if (e.message?.includes("SCRIPT_LIMIT_REACHED")) {
        return { success: false, limitReached: "script" };
      }
      
      setState((s) => ({ ...s, error: e.message }));
      return { success: false };
    }
  },[chatId, state.inputText, state.sending]);

  // HANDLE HOOK SELECTION (With Optimistic UI for User Message)
  const handleSaveSelection = useCallback(async (type: "hook" | "caption" | "script", text: string) => {
    const tempId = `temp-${type}-${Date.now()}`;
    const tempUserMsg: ChatMessage = {
      id: tempId, chat_id: chatId, sequence: 9999, 
      content: `Selected ${type}:\n${text}`, 
      source: "user", type: "text", metadata: null, created_at: new Date().toISOString()
    };

    setState((s) => ({ ...s, sending: true, messages:[...s.messages, tempUserMsg] }));

    try {
      const body: any = { chat_id: chatId };
      body[type] = text; // dynamically inject 'hook', 'script' or 'caption'
      
      const { user_message, ai_message } = await saveSelection(body);
      setState((s) => ({ 
        ...s, 
        sending: false, 
        messages:[...s.messages.filter(m => m.id !== tempId), user_message, ai_message] 
      }));
    } catch(e) {
      patch({ sending: false, error: `Failed to save ${type}` });
      setState((s) => ({ ...s, messages: s.messages.filter(m => m.id !== tempId) }));
    }
  }, [chatId]);

  const handleUpdateIdeaData = useCallback((newTitle: string, newScore: number, newMsgContent?: string) => {
    setState((s) => {
      if (!s.chat) return s;
      const updatedChat = { ...s.chat, title: newTitle };
      const updatedMessages = [...s.messages];
      if (updatedMessages.length > 0 && updatedMessages[0].source === "assistant") {
        updatedMessages[0] = {
          ...updatedMessages[0],
          content: newMsgContent || updatedMessages[0].content,
          metadata: { ...(updatedMessages[0].metadata || {}), win_score: newScore } as any
        };
      }
      return { ...s, chat: updatedChat, messages: updatedMessages };
    });
  },[]);

  return { state, bottomRef, setInputText, handleSend, handleUpdateIdeaData, handleSaveSelection };
}