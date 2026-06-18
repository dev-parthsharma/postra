// frontend/src/pages/Settings.tsx
// Refactored V2: Standardized theme-responsive settings page with active dark mode classes.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import DashboardLayout from "../components/layout/DashboardLayout";
import { Spinner } from "../components/Spinner";
import { API_BASE, updateContentGoal } from "../lib/apiBase";

interface UserProfile {
  name: string;
  niche: string;
  tone: string;
  style: string;
  goal: string;
  content_goal: string;
  language: "english" | "hinglish";
  streak_frequency: string;
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

type Section = "profile" | "content" | "account";

function SectionNav({ active, onChange }: { active: Section; onChange: (s: Section) => void }) {
  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    {
      id: "profile",
      label: "Profile",
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: "content",
      label: "Content",
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      id: "account",
      label: "Account",
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex sm:flex-col gap-1">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
            active === s.id
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-zinc-100"
          }`}
        >
          <span className={active === s.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-500"}>{s.icon}</span>
          {s.label}
          {active === s.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 hidden sm:block" />}
        </button>
      ))}
    </div>
  );
}

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  cols = 3,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  cols?: 2 | 3;
}) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all border ${
            value === opt
              ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-400 shadow-sm"
              : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/10"
          }`}
        >
          {value === opt && (
            <span className="inline-flex w-3.5 h-3.5 rounded-full bg-indigo-500 items-center justify-center mr-2">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
          )}
          {opt}
        </button>
      ))}
    </div>
  );
}

function SaveBanner({ show }: { show: boolean }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
      <div className="flex items-center gap-2.5 px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl text-sm font-medium">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-emerald-400">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Settings saved!
      </div>
    </div>
  );
}

// ── Language toggle ───────────────────────────────────────────────────────────

function LanguageToggle({
  value,
  onChange,
}: {
  value: "english" | "hinglish";
  onChange: (v: "english" | "hinglish") => void;
}) {
  return (
    <div className="flex gap-3">
      {(["english", "hinglish"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={`flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all duration-200 ${
            value === lang
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm"
              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-805/50"
          }`}
        >
          <span className="text-2xl">{lang === "english" ? "🇬🇧" : "🇮🇳"}</span>
          <div className="text-center">
            <p className={`text-sm font-semibold ${value === lang ? "text-indigo-700 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-200"}`}>
              {lang === "english" ? "English" : "Hinglish"}
            </p>
            <p className={`text-xs mt-0.5 ${value === lang ? "text-indigo-500" : "text-slate-400 dark:text-zinc-500"}`}>
              {lang === "english" ? "Standard English" : "Hindi + English mix"}
            </p>
          </div>
          {value === lang && (
            <span className="inline-flex w-4 h-4 rounded-full bg-indigo-500 items-center justify-center">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  const [profile, setProfile] = useState<UserProfile>({
    name: "", niche: "", tone: "", style: "", goal: "", content_goal: "", language: "english", streak_frequency: ""
  });

  const [initialStreakFreq, setInitialStreakFreq] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const { theme, setTheme } = useTheme();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // ── New In-App Streak Change Confirmation States ──
  const [showStreakConfirm, setShowStreakConfirm] = useState(false);
  const [pendingStreakFreq, setPendingStreakFreq] = useState<string | null>(null);

  // ── New Instagram Integration States ──
  const [igUsername, setIgUsername] = useState<string | null>(null);
  const [igLoading, setIgLoading] = useState(false);

  // Load active connection on mount
  useEffect(() => {
    const fetchIGConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from("instagram_connections")
        .select("instagram_username")
        .eq("user_id", user.id)
        .maybeSingle();
        
      if (data?.instagram_username) {
        setIgUsername(data.instagram_username);
      }
    };
    fetchIGConnection();
  }, [userId]);

  // 🟢 ManyChat-style 1-Click Business Login Handler
  const handleInstagramConnect = () => {
    if (!window.FB) {
      alert("Facebook SDK is still loading. Please refresh and try again!");
      return;
    }

    setIgLoading(true);

    window.FB.login(async (response: any) => {
      if (response.authResponse) {
        const fbAccessToken = response.authResponse.accessToken;
        
        try {
          // Send short-lived token to backend to exchange and save connection!
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${API_BASE}/api/integrations/instagram/connect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ fb_access_token: fbAccessToken }),
          });
          
          const result = await res.json();
          if (!res.ok) throw new Error(result.detail || "Connection failed");
          
          setIgUsername(result.username);
          alert(`Successfully connected as @${result.username}! 🎉`);
        } catch (err: any) {
          alert("Connection Error: " + (err.message || err));
        } finally {
          setIgLoading(false);
        }
      } else {
        alert("Connection cancelled or not fully authorized.");
        setIgLoading(false);
      }
    }, {
      // 🟢 This Configuration ID triggers the modern asset-based login popup!
      config_id: import.meta.env.VITE_META_CONFIG_ID,
    });
  };

  const handleDisconnectIG = async () => {
    const confirmDisc = window.confirm("Are you sure you want to disconnect your Instagram account?");
    if (!confirmDisc || !userId) return;
    setIgLoading(true);
    try {
      await supabase.from("instagram_connections").delete().eq("user_id", userId);
      setIgUsername(null);
    } catch (err) {
      alert("Failed to disconnect.");
    } finally {
      setIgLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("user_profile")
        .select("name, niche, tone, style, goal, content_goal, preferred_language, streak_frequency")  // ← added content_goal
        .eq("id", user.id)
        .single();

      if (data) {
        const freqValue = data.streak_frequency ?? "";
        
        setProfile({
          name: data.name ?? "",
          niche: data.niche ?? "",
          tone: data.tone ?? "",
          style: data.style ?? "",
          goal: data.goal ?? "",
          content_goal: data.content_goal ?? "",                  // ← added
          language: (data.preferred_language ?? "english") as "english" | "hinglish",
          streak_frequency: freqValue,
        });
        
        setInitialStreakFreq(freqValue);
      }
      
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    
    const { language, ...rest } = profile;

    try {
      // 🟢 V2: Reset user_stats history only if the posting frequency target actually changed
      if (profile.streak_frequency !== initialStreakFreq) {
        // 🟢 Direct delete query (Bypassed select check to prevent empty table crashes)
        const { error: delError } = await supabase
          .from("user_stats")
          .delete()
          .eq("user_id", userId);
          
        if (delError) throw delError;
        
        setInitialStreakFreq(profile.streak_frequency); // Update active reference
      }

      const { error: upsertError } = await supabase.from("user_profile").upsert({
        id: userId,
        ...rest,
        preferred_language: language,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 2500);
    } catch (err: any) {
      alert("Settings Save Error: Failed to save changes.\n\nReason: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    setPwLoading(true);
    setPwError(null);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setPwError(error.message); }
    else { setPwSuccess(true); setCurrentPw(""); setNewPw(""); setTimeout(() => setPwSuccess(false), 3000); }
    setPwLoading(false);
  };

  const avatarInitials = profile.name
    ? profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Manage your profile, content preferences, and account.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          <div className="sm:w-44 flex-shrink-0">
            {/* 🟢 FIXED: Theme-responsive Sidebar section-nav wrapper */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-2 shadow-sm animate-in fade-in duration-200">
              <SectionNav active={section} onChange={setSection} />
            </div>
          </div>

          <div className="flex-1 min-w-0">

            {/* ── Profile Section ── */}
            {section === "profile" && (
              <div className="space-y-6">
                {/* 🟢 FIXED: Theme-responsive Your Profile card wrapper */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-100 mb-5">Your Profile</h2>

                  {loading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" />
                          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
                          {avatarInitials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{profile.name || "Your Name"}</p>
                          <p className="text-xs text-slate-400 dark:text-zinc-500">{email}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Display name</label>
                          {/* 🟢 FIXED: Theme-responsive Input box (display name) */}
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Your name"
                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Email</label>
                          {/* 🟢 FIXED: Theme-responsive Input box (email - disabled) */}
                          <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl text-sm text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                          />
                          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Email cannot be changed here.</p>
                        </div>

                        {/* Language preference */}
                        <div>
                          <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                            Postra Output Language
                          </label>
                          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">
                            Choose how Postra talks to you in chats. English is the default.
                          </p>
                          <LanguageToggle
                            value={profile.language}
                            onChange={(v) => setProfile((p) => ({ ...p, language: v }))}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-sm"
                  >
                    {saving ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                    ) : "Save changes"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Content Section ── */}
            {section === "content" && (
              <div className="space-y-5">
                {loading ? (
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-3.5 w-24 bg-slate-100 rounded animate-pulse" />
                        <div className="grid grid-cols-3 gap-2">
                          {[...Array(6)].map((_, j) => <div key={j} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* 🟢 FIXED: Theme-responsive Your Niche wrapper card */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Your Niche</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">{profile.niche || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">Postra uses this to generate relevant ideas for you.</p>
                      <OptionGrid options={NICHES as any} value={profile.niche as any} onChange={(v) => setProfile((p) => ({ ...p, niche: v }))} cols={3} />
                    </div>

                    {/* 🟢 FIXED: Theme-responsive Your Tone wrapper card */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Your Tone</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">{profile.tone || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">AI will match your captions and scripts to this voice.</p>
                      <OptionGrid options={TONES as any} value={profile.tone as any} onChange={(v) => setProfile((p) => ({ ...p, tone: v }))} cols={2} />
                    </div>

                    {/* 🟢 FIXED: Theme-responsive Content Style wrapper card */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Content Style</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">{profile.style || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">How do you usually film or present your content?</p>
                      <OptionGrid options={STYLES as any} value={profile.style as any} onChange={(v) => setProfile((p) => ({ ...p, style: v }))} cols={2} />
                    </div>

                    {/* 🟢 FIXED: Theme-responsive Primary Goal wrapper card */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Primary Goal</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">{profile.goal || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">Helps Postra prioritise what matters to you.</p>
                      <OptionGrid options={GOALS as any} value={profile.goal as any} onChange={(v) => setProfile((p) => ({ ...p, goal: v }))} cols={2} />
                    </div>

                    {/* Content Goal */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Content Goal</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                          {profile.content_goal || "Not set"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">
                        Shapes the hooks, CTAs, and structure of every idea and post Postra generates.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {CONTENT_GOALS.map((g) => (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setProfile((p) => ({ ...p, content_goal: g.value }))}
                            className={`flex flex-col items-start gap-1 px-3 py-3 rounded-xl text-left transition-all border ${
                              profile.content_goal === g.value
                                ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-400 shadow-sm"
                                : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/10"
                            }`}
                          >
                            <span className="text-lg">{g.icon}</span>
                            <span className="text-xs font-semibold">{g.label}</span>
                            <span className={`text-xs ${profile.content_goal === g.value ? "text-indigo-400 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-500"}`}>
                              {g.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Your Posting Target (Streak)</h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                          {profile.streak_frequency ? "Active Target" : "Not set"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">
                        Choose how frequently you plan to post. Changing this target will reset your active streak back to 0 [4].
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { label: "🔥 2 Posts / Day", value: "2_day" },
                          { label: "⚡ 1 Post / Day", value: "1_day" },
                          { label: "📅 1 Post / 2 Days", value: "1_2days" },
                          { label: "📅 1 Post / 3 Days", value: "1_3days" },
                          { label: "📅 1 Post / 5 Days", value: "1_5days" },
                          { label: "📅 1 Post / Week", value: "1_week" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (profile.streak_frequency === opt.value) return; // Already selected, do nothing

                              // 🟢 In-App Popup trigger logic
                              setPendingStreakFreq(opt.value);
                              setShowStreakConfirm(true);
                            }}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all border ${
                              profile.streak_frequency === opt.value
                                ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-400 shadow-sm"
                                : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/10"
                            }`}
                          >
                            {profile.streak_frequency === opt.value && (
                              <span className="inline-flex w-3.5 h-3.5 rounded-full bg-indigo-500 items-center justify-center mr-2">
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </span>
                            )}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-sm"
                      >
                        {saving ? (
                          <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                        ) : "Save preferences"}
                      </button>
                    </div>
                      
                  </>
                )}
              </div>
            )}

            {/* ── Account Section ── */}
            {section === "account" && (
              <div className="space-y-5">
                {/* Appearance */}
                {/* 🟢 FIXED: Theme-responsive Appearance wrapper card */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-1">Appearance</h2>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mb-5">Choose how Postra looks to you.</p>
                  <div className="flex gap-3">
                    {(["light", "dark"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTheme(t)}
                        className={`flex-1 flex flex-col items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all duration-200 ${
                          theme === t
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm"
                            : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-750 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className={`w-full h-12 rounded-lg overflow-hidden border flex ${t === "light" ? "border-slate-200 bg-white" : "border-zinc-700 bg-zinc-900"}`}>
                          <div className={`w-8 flex-shrink-0 ${t === "light" ? "bg-white border-r border-slate-200" : "bg-zinc-900 border-r border-zinc-800"} flex flex-col gap-1 p-1.5`}>
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className={`h-1 rounded-full ${t === "light" ? "bg-slate-200" : "bg-zinc-700"} ${i === 0 ? "w-4" : "w-2.5"}`} />
                            ))}
                          </div>
                          <div className={`flex-1 ${t === "light" ? "bg-slate-50" : "bg-zinc-800"} flex flex-col gap-1 p-1.5`}>
                            <div className={`h-1.5 rounded ${t === "light" ? "bg-slate-200" : "bg-zinc-600"} w-3/4`} />
                            <div className={`h-1.5 rounded ${t === "light" ? "bg-indigo-100" : "bg-indigo-900"} w-1/2`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {theme === t && (
                            <span className="inline-flex w-3.5 h-3.5 rounded-full bg-indigo-500 items-center justify-center">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><path d="M20 6L9 17l-5-5" /></svg>
                            </span>
                          )}
                          <span className={`text-xs font-semibold ${theme === t ? "text-indigo-700 dark:text-indigo-400" : "text-slate-500 dark:text-zinc-400"}`}>
                            {t === "light" ? "☀️ Light" : "🌙 Dark"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-1">Integrations</h2>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mb-5">Connect your social media accounts to enable direct 1-click publishing [4].</p>

                  <div className="flex items-center justify-between p-4 border border-slate-150 dark:border-zinc-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f9abf2] to-[#b05ee1] flex items-center justify-center text-white text-lg">
                        📸
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">Instagram Professional</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500">
                          {igUsername ? `Connected as @${igUsername} ✅` : "Not connected yet"}
                        </p>
                      </div>
                    </div>

                    {igUsername ? (
                      <button
                        type="button"
                        disabled={igLoading}
                        onClick={handleDisconnectIG}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                      >
                        {igLoading ? "Disconnecting..." : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={igLoading}
                        onClick={handleInstagramConnect}
                        className="text-xs font-bold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/10 active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        {igLoading ? <Spinner /> : "Connect Instagram"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Change password */}
                {/* 🟢 FIXED: Theme-responsive Change Password wrapper card */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-4">Change Password</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">New password</label>
                      {/* 🟢 FIXED: Theme-responsive Password input */}
                      <input
                        type="password"
                        value={newPw}
                        onChange={(e) => { setNewPw(e.target.value); setPwError(null); }}
                        placeholder="Min. 8 characters"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-805 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all"
                      />
                    </div>
                    {pwError && (
                      <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pwError}</p>
                    )}
                    {pwSuccess && (
                      <p className="text-emerald-600 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">Password updated successfully!</p>
                    )}
                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={pwLoading || !newPw}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold transition-all disabled:opacity-40"
                    >
                      {pwLoading ? "Updating…" : "Update password"}
                    </button>
                  </div>
                </div>

                {/* Plan */}
                {/* 🟢 FIXED: Theme-responsive Current Plan wrapper card */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Current Plan</h2>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">Free</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "AI ideas / month", value: "15" },
                      { label: "Post workflows", value: "Unlimited" },
                      { label: "Scheduling", value: "Coming soon" },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-zinc-800/80 last:border-0">
                        <span className="text-sm text-slate-600 dark:text-zinc-300">{r.label}</span>
                        <span className="text-sm font-medium text-slate-800 dark:text-zinc-100">{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-sm shadow-indigo-200 dark:shadow-none"
                  >
                    Upgrade to Pro ✨
                  </button>
                </div>

                {/* Danger zone */}
                {/* 🟢 FIXED: Theme-responsive Danger Zone wrapper card */}
                <div className="bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-500/20 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Danger Zone</h2>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4">These actions are irreversible. Please proceed with care.</p>
                  <div className="flex items-center justify-between py-3 border border-red-100 dark:border-red-500/20 rounded-xl px-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">Delete account</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500">Permanently remove your account and all data.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SaveBanner show={showBanner} />

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => { setShowDeleteConfirm(false); setDeleteText(""); }}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-1">Delete your account?</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">This will permanently delete all your posts, ideas, and data. Type <strong>DELETE</strong> to confirm.</p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all text-slate-800 dark:text-zinc-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteText(""); }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteText !== "DELETE"}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {showStreakConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => { setShowStreakConfirm(false); setPendingStreakFreq(null); }}>
          <div 
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400 rounded-full flex items-center justify-center mb-4 mx-auto text-orange-500 text-xl animate-bounce">
              🔥
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Posting Target?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Changing your posting target will reset your current active streak back to <span className="font-bold text-red-500">0</span> [4]. Are you sure you want to proceed?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowStreakConfirm(false); setPendingStreakFreq(null); }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingStreakFreq) {
                    setProfile((p) => ({ ...p, streak_frequency: pendingStreakFreq }));
                  }
                  setShowStreakConfirm(false);
                  setPendingStreakFreq(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all active:scale-95"
              >
                Yes, Change
              </button>
            </div>
          </div>
        </div>
      )}
      
    </DashboardLayout>
  );
}