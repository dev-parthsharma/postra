// frontend/src/pages/AuthCallback.tsx
// Supabase redirects here after OAuth (Google / Facebook) and email confirmation.
// We detect if the user is brand-new (no onboarding_complete flag) and redirect
// accordingly. The onboarding popup is shown on the Home page.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      // Supabase JS v2 exchanges the code from the URL automatically when you
      // call getSession(). We just wait for the session to be ready.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        // Something went wrong — send them back to login
        navigate("/login", { replace: true });
        return;
      }

      // Check if this user has completed onboarding
      // We check if a row exists in user_profile at all — if not, they're new
      const { data: profile } = await supabase
        .from("user_profile")
        .select("id, niche")
        .eq("id", session.user.id)
        .single();

      // If no profile row or niche is empty → show onboarding
      if (!profile || !profile.niche) {
        // New user — go to home and show the onboarding popup
        navigate("/?onboarding=true", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };

    handle();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40 animate-pulse">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="8" cy="8" r="2" fill="white"/>
          </svg>
        </div>
        <p className="text-zinc-400 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}