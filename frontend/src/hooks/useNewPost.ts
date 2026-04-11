// frontend/src/hooks/useNewPost.ts
// All state and async logic for the New Post modal.
// The component stays purely presentational.

import { useState, useCallback } from "react";
import {
  generateIdeas,
  saveUserIdea,
  toggleFavourite,
  confirmIdea,
  type Idea,
  type Chat,
} from "../lib/ideasApi";

export type ModalView =
  | "input"       // initial: write idea or generate
  | "generated"   // 3 AI ideas shown
  | "confirming"  // user clicked an idea, confirm shown
  | "done";       // chat created, modal can close

export interface NewPostState {
  view: ModalView;
  inputText: string;
  generatedIdeas: Idea[];
  selectedIdea: Idea | null;
  createdChat: Chat | null;
  generating: boolean;
  saving: boolean;
  confirming: boolean;
  error: string | null;
}

const INITIAL: NewPostState = {
  view: "input",
  inputText: "",
  generatedIdeas: [],
  selectedIdea: null,
  createdChat: null,
  generating: false,
  saving: false,
  confirming: false,
  error: null,
};

export function useNewPost(onDone?: (chat: Chat) => void) {
  const [state, setState] = useState<NewPostState>(INITIAL);

  const patch = (partial: Partial<NewPostState>) =>
    setState((s) => ({ ...s, ...partial }));

  // ── Input ──────────────────────────────────────────────────────────────────

  const setInputText = useCallback((text: string) => {
    patch({ inputText: text, error: null });
  }, []);

  // ── Case 1: User writes their own idea ─────────────────────────────────────

  const submitUserIdea = useCallback(async () => {
    const text = state.inputText.trim();
    if (!text) return;

    patch({ saving: true, error: null });
    try {
      const saved = await saveUserIdea(text);
      // Treat the saved idea as "selected" and move to confirm step
      patch({ saving: false, selectedIdea: saved, view: "confirming" });
    } catch (e: unknown) {
      patch({ saving: false, error: (e as Error).message });
    }
  }, [state.inputText]);

  // ── Case 2: Generate 3 AI ideas ───────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    patch({ generating: true, error: null });
    try {
      const ideas = await generateIdeas();
      patch({ generating: false, generatedIdeas: ideas, view: "generated" });
    } catch (e: unknown) {
      patch({ generating: false, error: (e as Error).message });
    }
  }, []);

  // ── Favourite toggle ───────────────────────────────────────────────────────

  const handleToggleFavourite = useCallback(async (idea: Idea) => {
    // Optimistic update
    const next = !idea.is_favourite;
    setState((s) => ({
      ...s,
      generatedIdeas: s.generatedIdeas.map((i) =>
        i.id === idea.id ? { ...i, is_favourite: next } : i
      ),
    }));
    try {
      await toggleFavourite(idea.id, next);
    } catch {
      // Revert on failure
      setState((s) => ({
        ...s,
        generatedIdeas: s.generatedIdeas.map((i) =>
          i.id === idea.id ? { ...i, is_favourite: !next } : i
        ),
        error: "Failed to update favourite",
      }));
    }
  }, []);

  // ── Idea selection → confirm ───────────────────────────────────────────────

  const handleSelectIdea = useCallback((idea: Idea) => {
    patch({ selectedIdea: idea, view: "confirming", error: null });
  }, []);

  const handleBackFromConfirm = useCallback(() => {
    const backView: ModalView =
      state.generatedIdeas.length > 0 ? "generated" : "input";
    patch({ view: backView, selectedIdea: null, error: null });
  }, [state.generatedIdeas.length]);

  // ── Confirm → create chat ─────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!state.selectedIdea) return;
    patch({ confirming: true, error: null });
    try {
      const chat = await confirmIdea(state.selectedIdea.id, state.selectedIdea.idea);
      patch({ confirming: false, createdChat: chat, view: "done" });
      onDone?.(chat);
    } catch (e: unknown) {
      patch({ confirming: false, error: (e as Error).message });
    }
  }, [state.selectedIdea, onDone]);

  // ── Reset (for re-open) ───────────────────────────────────────────────────

  const reset = useCallback(() => setState(INITIAL), []);

  return {
    state,
    setInputText,
    submitUserIdea,
    handleGenerate,
    handleToggleFavourite,
    handleSelectIdea,
    handleBackFromConfirm,
    handleConfirm,
    reset,
  };
}