// frontend/src/pages/Settings.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "../components/layout/DashboardLayout";

interface UserProfile {
  name: string;
  niche: string;
  tone: string;
  style: string;
  goal: string;
}

const NICHES = ["Fitness", "Finance", "Fashion", "Food", "Tech", "Travel", "Education", "Lifestyle", "Comedy", "Business", "Gaming", "Beauty"];
const TONES = ["Casual & fun", "Professional", "Energetic & hype", "Calm & educational", "Inspirational", "Raw & honest"];
const STYLES = ["Face-to-camera talking", "Voiceover + B-roll", "Text on screen", "POV storytelling", "Educational breakdown", "Comedy skits"];
const GOALS = ["Grow followers", "Build a brand", "Monetise content", "Post consistently", "Just getting started"];

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
              ? "bg-indigo-50 text-indigo-700 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          <span className={active === s.id ? "text-indigo-600" : "text-slate-400"}>{s.icon}</span>
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
              ? "bg-indigo-50 border-indigo-300 text-indigo-800 shadow-sm"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Settings saved!
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  const [profile, setProfile] = useState<UserProfile>({ name: "", niche: "", tone: "", style: "", goal: "" });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Delete account modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("user_profile")
        .select("name, niche, tone, style, goal")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data as UserProfile);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("user_profile").upsert({
      id: userId,
      ...profile,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    setShowBanner(true);
    setTimeout(() => setShowBanner(false), 2500);
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your profile, content preferences, and account.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar Nav */}
          <div className="sm:w-44 flex-shrink-0">
            <div className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm">
              <SectionNav active={section} onChange={setSection} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">

            {/* ── Profile Section ── */}
            {section === "profile" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-800 mb-5">Your Profile</h2>

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
                      {/* Avatar */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
                          {avatarInitials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{profile.name || "Your Name"}</p>
                          <p className="text-xs text-slate-400">{email}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Display name</label>
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Your name"
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Email</label>
                          <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed"
                          />
                          <p className="text-xs text-slate-400 mt-1">Email cannot be changed here.</p>
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
                    {/* Niche */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800">Your Niche</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{profile.niche || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">Postra uses this to generate relevant ideas for you.</p>
                      <OptionGrid options={NICHES as any} value={profile.niche as any} onChange={(v) => setProfile((p) => ({ ...p, niche: v }))} cols={3} />
                    </div>

                    {/* Tone */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800">Your Tone</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{profile.tone || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">AI will match your captions and scripts to this voice.</p>
                      <OptionGrid options={TONES as any} value={profile.tone as any} onChange={(v) => setProfile((p) => ({ ...p, tone: v }))} cols={2} />
                    </div>

                    {/* Style */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800">Content Style</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{profile.style || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">How do you usually film or present your content?</p>
                      <OptionGrid options={STYLES as any} value={profile.style as any} onChange={(v) => setProfile((p) => ({ ...p, style: v }))} cols={2} />
                    </div>

                    {/* Goal */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800">Primary Goal</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{profile.goal || "Not set"}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">Helps Postra prioritise what matters to you.</p>
                      <OptionGrid options={GOALS as any} value={profile.goal as any} onChange={(v) => setProfile((p) => ({ ...p, goal: v }))} cols={2} />
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
                {/* Change password */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-800 mb-4">Change Password</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">New password</label>
                      <input
                        type="password"
                        value={newPw}
                        onChange={(e) => { setNewPw(e.target.value); setPwError(null); }}
                        placeholder="Min. 8 characters"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
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
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all disabled:opacity-40"
                    >
                      {pwLoading ? "Updating…" : "Update password"}
                    </button>
                  </div>
                </div>

                {/* Plan */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-800">Current Plan</h2>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">Free</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "AI ideas / month", value: "15" },
                      { label: "Post workflows", value: "Unlimited" },
                      { label: "Scheduling", value: "Coming soon" },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-600">{r.label}</span>
                        <span className="text-sm font-medium text-slate-800">{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-sm shadow-indigo-200"
                  >
                    Upgrade to Pro ✨
                  </button>
                </div>

                {/* Danger zone */}
                <div className="bg-white border border-red-100 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-red-700 mb-1">Danger Zone</h2>
                  <p className="text-xs text-slate-400 mb-4">These actions are irreversible. Please proceed with care.</p>
                  <div className="flex items-center justify-between py-3 border border-red-100 rounded-xl px-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Delete account</p>
                      <p className="text-xs text-slate-400">Permanently remove your account and all data.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all"
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

      {/* Save banner */}
      <SaveBanner show={showBanner} />

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Delete your account?</h3>
            <p className="text-sm text-slate-500 mb-4">This will permanently delete all your posts, ideas, and data. Type <strong>DELETE</strong> to confirm.</p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteText(""); }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all"
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
    </DashboardLayout>
  );
}