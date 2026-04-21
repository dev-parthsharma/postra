// frontend/src/pages/Ideas.tsx
// Shows all ideas. Highlighted (user-written OR favourited) pinned at top.
// Also has a "Save idea for later" section — input only, no AI.

import { useEffect, useState, useCallback } from "react";
import { listIdeas, saveUserIdea, toggleFavourite, confirmIdea, deleteIdea, ApiError, type Idea } from "../lib/ideasApi";
import { useNavigate } from "react-router-dom";
import { classifyIdea } from "../utils/ideaValidator";

function Spinner({ small = false }: { small?: boolean }) {
  return (
    <svg className={`animate-spin ${small ? "w-3 h-3" : "w-4 h-4"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function IdeaRow({
  idea,
  highlighted,
  onToggleFavourite,
  onStartChat,
  onDelete,
}: {
  idea: Idea;
  highlighted: boolean;
  onToggleFavourite: (idea: Idea) => void;
  onStartChat: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
}) {
  const [starting, setStarting] = useState(false);

  const handleStartChat = async () => {
    setStarting(true);
    await onStartChat(idea);
    setStarting(false);
  };

  return (
    <div className={`relative bg-zinc-900 border rounded-xl p-4 transition-all duration-200 ${
      highlighted
        ? "border-orange-500/30 bg-orange-500/5"
        : "border-zinc-800 hover:border-zinc-700"
    }`}>
      <div className="flex items-start gap-3">
        {/* Favourite star */}
        <button
          type="button"
          onClick={() => onToggleFavourite(idea)}
          className={`mt-0.5 flex-shrink-0 transition-colors duration-150 ${
            idea.is_favourite ? "text-orange-400" : "text-zinc-700 hover:text-zinc-500"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={idea.is_favourite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>

        {/* Idea text */}
        <div className="flex-1 min-w-0">
          <p className="text-zinc-200 text-sm leading-relaxed">{idea.idea}</p>
          <div className="flex items-center flex-wrap gap-2 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded border ${
              idea.source === "postra"
                ? "text-orange-400/70 bg-orange-500/5 border-orange-500/15"
                : "text-zinc-500 bg-zinc-800 border-zinc-700"
            }`}>
              {idea.source === "postra" ? "✨ AI" : "✍️ You"}
            </span>

            {idea.in_progress && (
              <span className="text-xs px-1.5 py-0.5 rounded border text-blue-400/70 bg-blue-500/5 border-blue-500/15">
                ⏳ In progress
              </span>
            )}

            <span className="text-zinc-600 text-xs">
              {new Date(idea.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {idea.source === "user" && (
            <button
              type="button"
              onClick={() => onDelete(idea)}
              className="text-zinc-600 hover:text-red-400 transition-colors duration-150"
              title="Delete idea"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {!idea.in_progress && (
            <button
              type="button"
              onClick={handleStartChat}
              disabled={starting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-all duration-150 disabled:opacity-50 shadow-md shadow-orange-500/20"
            >
              {starting ? <Spinner small /> : null}
              {starting ? "Starting…" : "Start Chat →"}
            </button>
          )}

          {idea.in_progress && (
            <button
              type="button"
              onClick={handleStartChat}
              disabled={starting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all duration-150 disabled:opacity-50"
            >
              {starting ? <Spinner small /> : null}
              {starting ? "Opening…" : "Continue →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveText, setSaveText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGibberish, setIsGibberish] = useState(false);
  const [confusedWarning, setConfusedWarning] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    try {
      const data = await listIdeas();
      setIdeas(data);
    } catch (e: unknown) {
      setFetchError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  const handleSave = async () => {
    const text = saveText.trim();
    if (!text) return;

    // Reset all error states
    setSaveError(null);
    setIsGibberish(false);
    setConfusedWarning(null);

    // Step 1: fast client-side gibberish check (no round trip)
    if (classifyIdea(text) === "gibberish") {
      setIsGibberish(true);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveUserIdea(text);

      // Idea was saved — add to list regardless
      setIdeas((prev) => [saved, ...prev]);
      setSaveText("");

      // If the backend flagged it as CONFUSED, surface the warning
      if (saved.warning && saved.message) {
        setConfusedWarning(saved.message);
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.type === "INVALID") {
          // Server-side gibberish catch (passed client check but failed AI check)
          setIsGibberish(true);
        } else {
          // Any other API error — show the readable message string
          setSaveError(e.message);
        }
      } else {
        setSaveError((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavourite = async (idea: Idea) => {
    const next = !idea.is_favourite;
    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, is_favourite: next } : i));
    try {
      await toggleFavourite(idea.id, next);
    } catch {
      setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, is_favourite: !next } : i));
    }
  };

  const handleDelete = async (idea: Idea) => {
    if (idea.in_progress) {
      const confirmed = window.confirm(
        "This idea has an active chat. Deleting it will also delete the chat and all its messages. Continue?"
      );
      if (!confirmed) return;
    }
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    try {
      await deleteIdea(idea.id);
    } catch (e: unknown) {
      setIdeas((prev) => [idea, ...prev]);
      console.error("Failed to delete idea:", e);
    }
  };

  const handleStartChat = async (idea: Idea) => {
    try {
      if (idea.in_progress && idea.chat_id) {
        navigate(`/chat/${idea.chat_id}`);
      } else {
        const chat = await confirmIdea(idea.id, idea.idea);
        navigate(`/chat/${chat.id}`);
      }
    } catch (e: unknown) {
      console.error("Failed to start/continue chat:", e);
    }
  };

  const isHighlighted = (idea: Idea) => idea.source === "user" || idea.is_favourite;
  const highlighted = ideas.filter(isHighlighted);
  const rest = ideas.filter((i) => !isHighlighted(i));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* ── Save idea for later ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-white font-semibold text-base mb-1">Save idea for later</h2>
        <p className="text-zinc-500 text-sm mb-4">
          Capture a quick idea now. No AI — just save it before it slips away.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={saveText}
            onChange={(e) => {
              setSaveText(e.target.value);
              setSaveError(null);
              setIsGibberish(false);
              setConfusedWarning(null);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && saveText.trim()) handleSave(); }}
            placeholder="Write your idea here…"
            className={`flex-1 bg-zinc-800 border rounded-xl px-4 py-2.5 text-zinc-200 text-sm placeholder-zinc-600 outline-none transition-colors duration-150 ${
              isGibberish
                ? "border-red-500/60 focus:border-red-500"
                : "border-zinc-700 focus:border-orange-500"
            }`}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!saveText.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Spinner small /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Gibberish error — shown for both client-side AND server INVALID */}
        {isGibberish && (
          <div className="mt-3 flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-base leading-none flex-shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-red-400 text-sm font-semibold">Invalid text</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                This doesn't look like a real idea. Write something meaningful, or let AI generate ideas for you.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsGibberish(false);
                  setSaveText("");
                  navigate("/dashboard");
                }}
                className="mt-2 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
              >
                ✨ Generate ideas on dashboard →
              </button>
            </div>
          </div>
        )}

        {/* CONFUSED warning — idea was saved but is vague */}
        {confusedWarning && (
          <div className="mt-3 flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-base leading-none flex-shrink-0 mt-0.5">🤔</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-400 text-sm font-semibold">Idea saved, but it's a bit vague</p>
              <p className="text-zinc-500 text-xs mt-0.5">{confusedWarning}</p>
              <button
                type="button"
                onClick={() => setConfusedWarning(null)}
                className="mt-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Generic API error — readable string, never [object Object] */}
        {saveError && (
          <p className="text-red-400 text-xs mt-2">{saveError}</p>
        )}
      </section>

      {/* ── Ideas list ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-zinc-600">
          <Spinner /> <span className="ml-2 text-sm">Loading ideas…</span>
        </div>
      ) : fetchError ? (
        <p className="text-red-400 text-sm">{fetchError}</p>
      ) : ideas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-600 text-sm">No ideas yet. Generate some or save one above.</p>
        </div>
      ) : (
        <>
          {highlighted.length > 0 && (
            <section>
              <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                ★ Your ideas & favourites
              </h3>
              <div className="space-y-2">
                {highlighted.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    highlighted={true}
                    onToggleFavourite={handleToggleFavourite}
                    onStartChat={handleStartChat}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                All generated ideas
              </h3>
              <div className="space-y-2">
                {rest.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    highlighted={false}
                    onToggleFavourite={handleToggleFavourite}
                    onStartChat={handleStartChat}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}