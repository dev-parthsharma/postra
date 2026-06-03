// frontend/src/pages/Ideas.tsx
// Brand New V2: Direct Content Ideas Planner Dashboard with Date Schedules, Concept Validations & Detail Overlay Modals.

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  listIdeas,
  deleteIdea,
  generateSingleIdea,
  improveIdea,
  validateIdea,
  checkDateSchedule,
  saveUserIdeaWithDate,
  generatePostForExistingIdea,
  confirmIdea,
  scheduleIdea,
} from "../lib/ideasApi";

// Date tomorrow
const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1); // Aaj ki date + 1 day
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // Returns e.g., "2026-06-03"
};

// ── Spinner Helper ────────────────────────────────────────────────────────────
function Spinner({ small = false, size = 16 }: { small?: boolean; size?: number }) {
  return (
    <svg className="animate-spin text-indigo-600" style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── WinScore Badge ────────────────────────────────────────────────────────────
function WinScore({ score }: { score: number | null | undefined }) {
  if (!score) return null;
  const color =
    score >= 8 ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20" :
    score >= 6 ? "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20" :
                 "text-slate-500 bg-slate-100 border-slate-200 dark:text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      {score}/10
    </span>
  );
}

// ── PLANNER OVERLAY MODAL (SAVE IDEAS DIRECTLY) ──
interface CreateIdeaModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function CreateIdeaModal({ onClose, onSaved }: CreateIdeaModalProps) {
  const [ideaText, setIdeaText] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI Loading states
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Mismatch & Double Schedules Modals
  const [showNicheWarning, setShowNicheWarning] = useState(false);
  const [detectedNiche, setDetectedNiche] = useState("");
  const [userNiche, setUserNiche] = useState("");

  const [showScheduleConflict, setShowScheduleConflict] = useState(false);
  const [conflictingIdeaText, setConflictingIdeaText] = useState("");

  const handleGetNicheIdea = async () => {
    setIsGeneratingIdea(true);
    setErrorMsg(null);
    try {
      const res = await generateSingleIdea();
      if (res?.idea) {
        setIdeaText(res.idea);
      } else {
        setErrorMsg("Could not find a trending idea right now.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to generate idea.");
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const handleImprove = async () => {
    if (!ideaText.trim()) return;
    setIsImproving(true);
    try {
      const res = await improveIdea("temp", ideaText); 
      setIdeaText(res.improved_idea);
    } catch (e) {
      console.error(e);
    } finally {
      setIsImproving(false);
    }
  };

  const handleSaveInitiate = async () => {
    if (!ideaText.trim()) return;

    // 🟢 Past date bypass protection check
    const tomorrow = getTomorrowStr();
    if (scheduledDate && scheduledDate < tomorrow) {
      setErrorMsg("Scheduled date must be tomorrow or further!");
      setTimeout(() => setErrorMsg(null), 5000); // 5 seconds error popup
      return;
    }

    setIsValidating(true);
    setErrorMsg(null);

    try {
      const check = await validateIdea(ideaText);
      setIsValidating(false);

      if (!check.valid) {
        setErrorMsg(check.message || "This doesn't look like a real idea.");
        setTimeout(() => setErrorMsg(null), 5000); 
        return;
      }

      if (scheduledDate) {
        const conflict = await checkDateSchedule(scheduledDate);
        if (conflict.scheduled) {
          setConflictingIdeaText(conflict.existing_idea?.idea || "");
          setShowScheduleConflict(true);
          return;
        }
      }

      if (!check.niche_match) {
        setDetectedNiche(check.detected_niche);
        setUserNiche(check.user_niche);
        setShowNicheWarning(true);
      } else {
        executeSave();
      }
    } catch (e: any) {
      setIsValidating(false);
      setErrorMsg(e.message || "Failed to validate idea.");
    }
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      await saveUserIdeaWithDate(ideaText, scheduledDate || undefined);
      onSaved();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to save idea.");
    } finally {
      setSaving(false);
    }
  };

  const isIdeaEmpty = !ideaText.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col relative">
        
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Add Idea Planner <span className="text-xl">💡</span>
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
            ✖
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium flex justify-between items-center border border-red-100 dark:border-red-500/20">
              <span className="flex-1 pr-2">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-xs font-bold">✖</button>
            </div>
          )}

          {/* Text Area */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Your Idea</span>
            <textarea 
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              placeholder="What is your content concept? (e.g. 3 morning habits for productivity)"
              className="w-full h-32 resize-none rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 p-4 text-[14.5px] outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all dark:text-white"
            />
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Plan Date (Optional)</span>
            <input 
              type="date" 
              value={scheduledDate}
              min={getTomorrowStr()}
              onKeyDown={(e) => e.preventDefault()}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-zinc-200 outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {isIdeaEmpty ? (
              <button 
                type="button"
                onClick={handleGetNicheIdea}
                disabled={isGeneratingIdea}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isGeneratingIdea ? (
                  <div className="flex items-center gap-2">
                    <Spinner small />
                    <span>Generating Trending Idea...</span>
                  </div>
                ) : (
                  "💡 Get Niche Idea"
                )}
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleImprove}
                disabled={isImproving}
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isImproving ? "Improving..." : "🪄 Improve this idea"}
              </button>
            )}

            <button 
              type="button"
              onClick={handleSaveInitiate}
              disabled={isIdeaEmpty || saving || isValidating}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving || isValidating ? <Spinner small /> : "Save Idea to Planner"}
            </button>
          </div>

        </div>

        {/* ── NICHE WARNING CONFIRMATION OVERLAY POPUP ── */}
        {showNicheWarning && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Niche Mismatch</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  This idea seems to belong to <span className="font-bold text-slate-800 dark:text-zinc-200">"{detectedNiche}"</span>, but your profile niche is set to <span className="font-bold text-slate-800 dark:text-zinc-200">"{userNiche}"</span>.
                </p>
                <p className="text-[11px] text-indigo-500 dark:text-indigo-400 italic bg-indigo-50/50 dark:bg-indigo-500/5 p-2 rounded-xl border border-indigo-100/30">
                  Tip: If you want to change your niche permanently, you can update it in Settings.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNicheWarning(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNicheWarning(false);
                    executeSave(); 
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Save Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DOUBLE SCHEDULE / DATE CONFLICT WARNING OVERLAY ── */}
        {showScheduleConflict && (
          <div className="absolute inset-0 z-[65] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto text-xl">
                📅
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Date Already Booked</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  You already have another idea scheduled for this day:
                </p>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-850 truncate italic">
                  "{conflictingIdeaText}"
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Do you want to proceed and save multiple ideas on this same day?
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleConflict(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs"
                >
                  Change Date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleConflict(false);
                    executeSave();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Save Multiple
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── DETAILS & 1-CLICK GENERATION MODAL OVERLAY ──
interface IdeaDetailsModalProps {
  idea: any;
  onClose: () => void;
  onPostCreated: (postId: string) => void;
}

function IdeaDetailsModal({ idea, onClose, onPostCreated }: IdeaDetailsModalProps) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGeneratePost = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await generatePostForExistingIdea(idea.id);
      onPostCreated(res.id); 
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to auto-generate post.");
      setGenerating(false);
    }
  };

  const formattedDate = idea.scheduled_date
    ? new Date(idea.scheduled_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "Unscheduled";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col relative">
        
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>📅</span> Idea Details
          </h3>
          <button onClick={onClose} disabled={generating} className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
            ✖
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <p className="text-red-500 text-xs font-semibold">{errorMsg}</p>
          )}

          {generating ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              {/* Size prop resolved */}
              <Spinner size={32} />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Auto-Generating Post...</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Crafting high-converting hooks, custom video script, and copy.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Content Idea</span>
                <p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-zinc-100">
                  {idea.idea}
                </p>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-850 rounded-2xl p-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Planned Date</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{formattedDate}</span>
                </div>
                <WinScore score={idea.win_score} />
              </div>

              <div className="pt-2">
                {idea.post_status === "published" ? (
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                    Post Published ✅
                  </div>
                ) : (
                  <button
                    onClick={handleGeneratePost}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/15 transition-all active:scale-95"
                  >
                    Generate Post ⚡
                  </button>
                )}
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}

// ── CUSTOM IDEA CARD (RESTORED ALIGNMENT & COMPACT DESIGN) ──
function CustomIdeaCard({
  idea,
  onOpenDetails,
  onDelete,
  onScheduleIdea,
}: {
  idea: any;
  onOpenDetails: (idea: any) => void;
  onDelete: (id: string) => void;
  onScheduleIdea: (id: string, date: string) => Promise<void>;
}) {
  const formattedDate = idea.scheduled_date
    ? new Date(idea.scheduled_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  return (
    /* 🟢 FIXED: Added theme-responsive bg, border, and hover classes */
    <div 
      onClick={() => onOpenDetails(idea)} 
      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 hover:shadow-md transition-all group flex flex-col justify-between h-full space-y-4 cursor-pointer shadow-sm"
    >
      <div className="space-y-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 🟢 FIXED: Theme-responsive source badge styling */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
              idea.source === "postra" 
                ? "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20"
                : "text-slate-500 bg-slate-50 border-slate-200 dark:text-zinc-500 dark:bg-zinc-800 dark:border-zinc-850"
            }`}>
              {idea.source === "postra" ? "✨ AI Idea" : "✍️ Custom"}
            </span>
            <WinScore score={idea.win_score} />
          </div>

          {/* Delete Trash Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(idea.id); }} 
            className="text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-150 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/5 z-10"
            title="Delete Idea"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* 🟢 FIXED: Changed text-zinc-100 to theme-responsive text-slate-800 dark:text-zinc-100 */}
        <p className="text-slate-800 dark:text-zinc-100 text-sm font-semibold leading-relaxed line-clamp-3">
          {idea.idea}
        </p>
      </div>

      {/* 🟢 FIXED: Border-t color changed to border-slate-100 dark:border-zinc-800 */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
        <div>
          {/* direct input layout jo update aur schedule dono seamlessly allow karta hai */}
          <div 
            onClick={(e) => e.stopPropagation()} // Card popup trigger ko rokne ke liye
            className="flex items-center gap-1.5"
          >
            {/* 🟢 FIXED: Input element bg, border, and text colors are now fully theme-responsive */}
            <input 
              type="date"
              value={idea.scheduled_date || ""} // Direct database value map ho rahi hai
              min={getTomorrowStr()}
              onKeyDown={(e) => e.preventDefault()} // Typing block
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker(); // Tap karte hi calendar open
                } catch (err) {}
              }}
              onChange={async (e) => {
                const selectedDate = e.target.value;
                // Agar date select ki hai toh save karega, agar calendar se clear ki hai toh blank/null karega
                await onScheduleIdea(idea.id, selectedDate || "");
              }}
              className="bg-slate-50 dark:bg-zinc-800 border border-slate-250 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-[11px] text-slate-700 dark:text-zinc-300 outline-none focus:border-indigo-500 transition-all cursor-pointer"
            />
          </div>
        </div>

        {/* 🟢 FIXED: Changed text-indigo-400 to text-indigo-600 dark:text-indigo-400 */}
        <span className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          Details →
        </span>
      </div>

    </div>
  );
}

export default function IdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIdeaDetail, setSelectedIdeaDetail] = useState<any | null>(null);

  // Safety Delete States
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ── New In-App Conflict States ──
  const [showScheduleConflict, setShowScheduleConflict] = useState(false);
  const [conflictTargetId, setConflictTargetId] = useState<string | null>(null);
  const [conflictTargetDate, setConflictTargetDate] = useState<string | null>(null);
  const [conflictingIdeaText, setConflictingIdeaText] = useState("");

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listIdeas();
      
      // 🟢 V2 Fix: Only show ideas that have NOT been converted into posts yet
      const plainIdeas = data.filter((idea: any) => !idea.post_id);
      setIdeas(plainIdeas);
    } catch (e: unknown) {
      setFetchError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchIdeas(); 
  }, [fetchIdeas]);

  const handleDeleteTrigger = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteIdea = async (id: string) => {
    setDeleteTargetId(null);
    const previousIdeas = [...ideas];
    setIdeas((prev) => prev.filter((i) => i.id !== id));

    try {
      await deleteIdea(id);
    } catch (e: any) {
      setIdeas(previousIdeas);
      alert("Failed to delete idea from database: " + e.message);
    }
  };

  const handleScheduleIdea = async (id: string, date: string) => {
    try {
      if (!date) {
        await executeScheduleSave(id, null);
        return;
      }

      const conflict = await checkDateSchedule(date);
      if (conflict.scheduled && conflict.existing_idea?.id !== id) {
        setConflictingIdeaText(conflict.existing_idea?.idea || "");
        setConflictTargetId(id);
        setConflictTargetDate(date);
        setShowScheduleConflict(true);
        return;
      }

      await executeScheduleSave(id, date);
    } catch (e: any) {
      alert("Failed to schedule idea: " + e.message);
    }
  };

  const executeScheduleSave = async (id: string, date: string | null) => {
    try {
      await scheduleIdea(id, date);
      fetchIdeas(); // Reload grid lists
    } catch (e: any) {
      alert("Failed to save schedule: " + e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-8 space-y-6">

      {/* ── HEADER & CREATE TRIGGER ── */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Idea Planner</h2>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Plan dates, draft concepts, and directly generate post packages.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/10 active:scale-95 transition-all self-start sm:self-auto"
        >
          <span>💡</span> Create New Idea
        </button>
      </section>

      {fetchError && (
        <p className="text-red-500 text-sm">{fetchError}</p>
      )}

      {/* ── IDEAS PLANNED CARDS GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 animate-pulse h-48" />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-2xl">
            📅
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Your Planner is Empty</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
              No ideas planned yet. Start by generating niche ideas or write down your custom concept today!
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
          >
            Create New Idea
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ideas.map((idea: any) => (
            <CustomIdeaCard
              key={idea.id}
              idea={idea}
              onOpenDetails={(item) => setSelectedIdeaDetail(item)} 
              onDelete={handleDeleteTrigger}
              onScheduleIdea={handleScheduleIdea}
            />
          ))}
        </div>
      )}

      {/* ── CREATE IDEA PLANNER MODAL OVERLAY ── */}
      {showCreateModal && (
        <CreateIdeaModal
          onClose={() => setShowCreateModal(false)}
          onSaved={fetchIdeas}
        />
      )}

      {/* ── DETAILS & 1-CLICK GENERATION MODAL OVERLAY ── */}
      {selectedIdeaDetail && (
        <IdeaDetailsModal
          idea={selectedIdeaDetail}
          onClose={() => setSelectedIdeaDetail(null)}
          onPostCreated={(postId) => {
            setSelectedIdeaDetail(null);
            navigate(`/chat/${postId}`); 
          }}
        />
      )}

      {/* ── SAFETY DELETE CONFIRMATION OVERLAY ── */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Idea?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to delete this idea? If you created a draft post for it, that post will <span className="font-bold text-red-500">also be permanently deleted</span> [13].
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteIdea(deleteTargetId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 🟢 IN-APP DATE CONFLICT CONFIRMATION OVERLAY ── */}
        {showScheduleConflict && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto text-xl animate-pulse">
                📅
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Date Already Booked</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Another idea is already planned for this day:
                </p>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl border border-slate-150 dark:border-zinc-850 truncate italic">
                  "{conflictingIdeaText}"
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleConflict(false);
                    setConflictTargetId(null);
                    setConflictTargetDate(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-all active:scale-95"
                >
                  Select Another Date
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowScheduleConflict(false);
                    if (conflictTargetId && conflictTargetDate) {
                      await executeScheduleSave(conflictTargetId, conflictTargetDate);
                    }
                    setConflictTargetId(null);
                    setConflictTargetDate(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Confirm Anyway
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}