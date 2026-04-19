// frontend/src/components/LanguagePreferenceModal.tsx
// Shown once per login session (not every page load, not daily — only on login).
// Asks user if they want English or Hinglish output from Postra.
// Saves preference to user_profile.language in Supabase.

import { useState } from "react";
import { supabase } from "../lib/supabase";

interface Props {
  userId: string;
  currentLanguage: string;
  onClose: () => void;
}

export default function LanguagePreferenceModal({ userId, currentLanguage, onClose }: Props) {
  const [selected, setSelected] = useState<"english" | "hinglish">(
    currentLanguage === "hinglish" ? "hinglish" : "english"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from("user_profile")
      .update({ preferred_language: selected, updated_at: new Date().toISOString() })
      .eq("id", userId);
    setSaving(false);
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-4">
            <span className="text-2xl">💬</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">How should Postra talk to you?</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
            Pick the language style for Postra's chat messages. You can always change this in Settings.
          </p>
        </div>

        {/* Options */}
        <div className="px-6 pb-4 space-y-3">
          {/* English */}
          <button
            type="button"
            onClick={() => setSelected("english")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              selected === "english"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                : "border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600"
            }`}
          >
            <span className="text-2xl flex-shrink-0">🇬🇧</span>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${selected === "english" ? "text-indigo-700 dark:text-indigo-400" : "text-slate-800 dark:text-zinc-200"}`}>
                English
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                "This idea has a solid angle. Want me to generate hooks?"
              </p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              selected === "english"
                ? "border-indigo-500 bg-indigo-500"
                : "border-slate-300 dark:border-zinc-600"
            }`}>
              {selected === "english" && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
          </button>

          {/* Hinglish */}
          <button
            type="button"
            onClick={() => setSelected("hinglish")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              selected === "hinglish"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                : "border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600"
            }`}
          >
            <span className="text-2xl flex-shrink-0">🇮🇳</span>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${selected === "hinglish" ? "text-indigo-700 dark:text-indigo-400" : "text-slate-800 dark:text-zinc-200"}`}>
                Hinglish
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                "Ye idea solid hai yaar. Hooks generate karu?"
              </p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              selected === "hinglish"
                ? "border-indigo-500 bg-indigo-500"
                : "border-slate-300 dark:border-zinc-600"
            }`}>
              {selected === "hinglish" && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : null}
            {saving ? "Saving…" : "Save preference"}
          </button>
        </div>
      </div>
    </div>
  );
}