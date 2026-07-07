// frontend\src\hooks\useAuth.ts

import { useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

// ── Cookie Synchronization Helpers ───────────────────────────────────────────
// These helpers sync the session state with the Vercel Edge Middleware
const setSessionCookie = () => {
  document.cookie = "postra_session_active=true; path=/; max-age=31536000; SameSite=Lax; Secure";
};

const clearSessionCookie = () => {
  document.cookie = "postra_session_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure";
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // 🔥 REAL CHECK (user DB me exist karta hai ya nahi)
        const { data: userData, error } = await supabase.auth.getUser();
      
        if (error || !userData.user) {
          clearSessionCookie(); // Sync cookie on auth failure
          await supabase.auth.signOut();
          setState({ user: null, session: null, loading: false });
          return;
        }
        setSessionCookie(); // Sync cookie on auth success
      } else {
        clearSessionCookie(); // Sync cookie on unauthenticated mount
      }
    
      setState({ user: session?.user ?? null, session, loading: false });
    });

    // Listen for auth state changes (OAuth redirects, sign-out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const { data: userData, error } = await supabase.auth.getUser();
        
          if (error || !userData.user) {
            clearSessionCookie(); // Sync cookie on auth failure
            await supabase.auth.signOut();
            setState({ user: null, session: null, loading: false });
            return;
          }
          setSessionCookie(); // Set cookie on sign-in or OAuth callback completion
        } else {
          clearSessionCookie(); // Clear cookie on sign-out
        }
      
        setState({ user: session?.user ?? null, session, loading: false });
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Email / Password ──────────────────────────────────────────────────────
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName ?? "" },
        // After email confirmation, redirect back to your app
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // Note: onAuthStateChange handles setting the session cookie on successful response
    return data;
  };

  const signOut = async () => {
    clearSessionCookie(); // Explicitly remove session cookie on manual logout
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // ── OAuth ─────────────────────────────────────────────────────────────────
  // After OAuth login, Supabase redirects to /auth/callback.
  // Your AppRouter should handle that route and redirect to "/" (home/dashboard).
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  // ── Password reset ────────────────────────────────────────────────────────
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  };

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    logout: signOut,
    signInWithGoogle,
    resetPassword,
  };
}