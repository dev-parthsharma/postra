// frontend/src/components/OnboardingModal.tsx
// Shown once after a new user signs up (email or OAuth).
// Saves to the `user_profile` table in Supabase.
// Table columns: id, name, niche, tone, style, goal, created_at, updated_at, niche_changed_at

import { useState } from "react";
import { supabase } from "../lib/supabase";

interface Props {
  userId: string;
  onComplete: () => void;
}

const NICHES = ["Fitness", "Finance", "Fashion", "Food", "Tech", "Travel", "Education", "Lifestyle", "Comedy", "Business", "Gaming", "Beauty"];
const TONES = ["Casual & fun", "Professional", "Energetic & hype", "Calm & educational", "Inspirational", "Raw & honest"];
const STYLES = ["Face-to-camera talking", "Voiceover + B-roll", "Text on screen", "POV storytelling", "Educational breakdown", "Comedy skits"];
const GOALS = ["Grow followers", "Build a brand", "Monetise content", "Post consistently", "Just getting started"];
const CONTENT_GOALS = [
  { value: "views",      label: "Views",      icon: "👁️",  desc: "Maximise reach & impressions" },
  { value: "engagement", label: "Engagement", icon: "💬",  desc: "Drive comments, shares & saves" },
  { value: "followers",  label: "Followers",  icon: "➕",  desc: "Grow your audience" },
  { value: "authority",  label: "Authority",  icon: "🏆",  desc: "Build credibility & thought leadership" },
  { value: "leads",      label: "Leads",      icon: "🎯",  desc: "Generate DMs & sign-ups" },
  { value: "sales",      label: "Sales",      icon: "💰",  desc: "Drive direct purchases" },
] as const;

type ContentGoalValue = typeof CONTENT_GOALS[number]["value"];

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function OnboardingModal({ userId, onComplete }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("");
  const [style, setStyle] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentGoal, setContentGoal] = useState<ContentGoalValue | "">("");

  // Pull the user's display name from Supabase auth metadata
  const getUserName = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "";
  };

  const canNext = () => {
    if (step === 0) return !!niche;
    if (step === 1) return !!tone;
    if (step === 2) return !!style;
    if (step === 3) return !!goal;
    if (step === 4) return !!contentGoal;
    return true;
  };

  const next = () => {
    if (step < 5) setStep((s: Step) => (s + 1) as Step);
  };

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const name = await getUserName();

      const { error: upsertError } = await supabase.from("user_profile").upsert({
        id: userId,
        name,
        niche,
        tone,
        style,
        goal,
        content_goal: contentGoal,
        niche_changed_at: now,
        updated_at: now,
      });
      if (upsertError) throw upsertError;
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save. Try again.");
      setSaving(false);
    }
  };

  const steps = ["Your niche", "Your tone", "Your style", "Your goal", "Content goal", "You're ready!"];

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-zinc-800">
          <div
            className="h-1 bg-orange-500 transition-all duration-500"
            style={{ width: `${((step + 1) / 6) * 100}%` }}
          />
        </div>

        <div className="p-8 space-y-6">
          {/* Step label */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-orange-400 uppercase tracking-wider">
              Step {step + 1} of 6
            </span>
            <span className="text-xs text-zinc-600">{steps[step]}</span>
          </div>

          {/* ── Step 0: Niche ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">What's your niche?</h2>
                <p className="text-zinc-400 text-sm mt-1">Postra uses this to generate relevant ideas for you.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n} type="button"
                    onClick={() => setNiche(n)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
                      niche === n
                        ? "bg-orange-500/20 border-orange-500 text-orange-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: Tone ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">How do you communicate?</h2>
                <p className="text-zinc-400 text-sm mt-1">We'll match your scripts and captions to your style.</p>
              </div>
              <div className="flex flex-col gap-2">
                {TONES.map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setTone(t)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all duration-150 border ${
                      tone === t
                        ? "bg-orange-500/20 border-orange-500 text-orange-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Style ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">What's your content style?</h2>
                <p className="text-zinc-400 text-sm mt-1">How do you usually film or present your content?</p>
              </div>
              <div className="flex flex-col gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => setStyle(s)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all duration-150 border ${
                      style === s
                        ? "bg-orange-500/20 border-orange-500 text-orange-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Goal ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">What's your main goal?</h2>
                <p className="text-zinc-400 text-sm mt-1">This helps Postra prioritise what matters to you.</p>
              </div>
              <div className="flex flex-col gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g} type="button"
                    onClick={() => setGoal(g)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all duration-150 border ${
                      goal === g
                        ? "bg-orange-500/20 border-orange-500 text-orange-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: Content Goal ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">What's your content goal?</h2>
                <p className="text-zinc-400 text-sm mt-1">
                  Postra uses this to shape every idea, hook, and CTA it generates for you.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setContentGoal(g.value)}
                    className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl text-left transition-all duration-150 border ${
                      contentGoal === g.value
                        ? "bg-orange-500/20 border-orange-500 text-orange-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    <span className="text-xl">{g.icon}</span>
                    <span className="text-sm font-semibold">{g.label}</span>
                    <span className="text-xs text-zinc-400">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 5: Ready ── */}
          {step === 5 && (
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <span className="text-3xl">🚀</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">You're all set!</h2>
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                  Postra knows your <span className="text-orange-300 font-medium">{niche}</span> niche,
                  your <span className="text-orange-300 font-medium lowercase">{tone}</span> tone,
                  your <span className="text-orange-300 font-medium lowercase">{style}</span> style,
                  your goal to <span className="text-orange-300 font-medium lowercase">{goal}</span>,
                  and your content goal of <span className="text-orange-300 font-medium lowercase">{contentGoal}</span>.
                  <br /><br />
                  Your first ideas are ready.
                </p>
              </div>
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between pt-2">
            {step > 0 && step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s: Step) => (s - 1) as Step)}
                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
              >
                ← Back
              </button>
            ) : <div />}

            {step < 5 ? (
              <button
                type="button" onClick={next}
                disabled={!canNext()}
                className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25"
              >
                Next →
              </button>
            ) : (
              <button
                type="button" onClick={finish}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Saving…
                  </>
                ) : "Go to Postra →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}