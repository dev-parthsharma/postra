// frontend/src/components/OnboardingReferralModal.tsx

import { useState, useEffect } from "react";
import { applyReferralCode } from "../lib/referralApi";
import { getDeviceFingerprint } from "../utils/fingerprint";
import { supabase } from "../lib/supabase";
import logo from "../assets/postra-logo.png";

interface ReferralModalProps {
  userId: string;
  onComplete: () => void;
}

export default function OnboardingReferralModal({ userId, onComplete }: ReferralModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Automatically fetch any captured referral link codes from localStorage on mount
  useEffect(() => {
    const savedCode = localStorage.getItem("postra_captured_ref_code");
    if (savedCode) {
      setCode(savedCode.trim().toUpperCase());
    }
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const deviceId = await getDeviceFingerprint();
      const res = await applyReferralCode(code.trim(), deviceId);
      
      if (res.success) {
        setSuccess(true);
        // Clear captured storage code
        localStorage.removeItem("postra_captured_ref_code");
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Failed to apply referral code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      // Mark step completed in the database directly
      await supabase
        .from("user_profile") 
        .update({ referral_step_completed: true })
        .eq("id", userId);
      
      localStorage.removeItem("postra_captured_ref_code");
      onComplete();
    } catch (err) {
      console.error("Failed to skip referral step:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1a1d27] w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
        
        <div className="p-6 text-center space-y-6">
          {/* Top Icon */}
          <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 2h2zm0 0h4l-1 13H9L8 8h4z" />
            </svg>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Got a Referral Code?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
              Apply a friend's referral code to instantly claim a **7-day Pro Trial** and a **20% discount** on your first subscription.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-2">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Referral code successfully applied!
            </div>
          )}

          {!success && (
            <form onSubmit={handleApply} className="space-y-4">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                placeholder="ENTER CODE (e.g. PARTH820)"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-center font-mono font-bold tracking-wider placeholder-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 py-3 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
                >
                  {loading ? "Applying..." : "Apply"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}