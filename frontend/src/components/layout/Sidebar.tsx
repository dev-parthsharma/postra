// src/components/layout/Sidebar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    to: "/dashboard",
    label: "Home",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: "/ideas",
    label: "Ideas",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    to: "/media",
    label: "Media",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/drafts",
    label: "Drafts",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    to: "/scheduled",
    label: "Scheduled",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/published",
    label: "Published",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: "/calendar",
    label: "Calendar",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    to: "/automations",
    label: "Automations",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
];

const bottomItems: NavItem[] = [
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ALL helper components defined at module level (outside Sidebar).
// This is critical: components defined inside another component get a NEW
// identity on every render, causing React to unmount+remount them — which
// resets state and re-fires effects (= loading flash on every navigation).
// ─────────────────────────────────────────────────────────────────────────────

function InstagramStrip({ userId }: { userId: string | undefined }) {
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) { setReady(true); return; }
    supabase
      .from("instagram_connections")
      .select("instagram_username")
      .eq("user_id", userId)
      .maybeSingle()        // returns null (not 406) when no row exists
      .then(({ data }) => {
        setUsername(data?.instagram_username ?? null);
        setReady(true);
      });
  }, [userId]);             // only re-runs when userId changes (i.e. once)

  if (!ready) return null;  // hidden until resolved — no spinner flash

  return (
    <div className="mx-3 mb-1">
      <div
        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium border select-none ${
          username
            ? "bg-rose-50 dark:bg-rose-500/[0.07] text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/15"
            : "bg-slate-50 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 border-slate-100 dark:border-white/[0.06]"
        }`}
      >
        <span
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={
            username
              ? { background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }
              : { background: "rgba(148,163,184,0.2)" }
          }
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill={username ? "white" : "rgba(148,163,184,0.6)"}>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
        </span>
        {username ? (
          <>
            <span className="flex-1 truncate">@{username}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          </>
        ) : (
          <span className="flex-1">Connect Instagram</span>
        )}
      </div>
    </div>
  );
}

function PlanStrip({ plan, onUpgrade }: { plan: string; onUpgrade: () => void }) {
  const label = plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
  const isFree = plan.toLowerCase() === "free";

  return (
    <div className="mx-3 mb-3 mt-1">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06]">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
            isFree
              ? "bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400"
              : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          }`}
        >
          {label.toUpperCase()}
        </span>
        <span className="flex-1 text-xs text-slate-400 dark:text-slate-500 truncate">
          {isFree ? "Free plan" : `${label} plan`}
        </span>
        <button
          type="button"
          onClick={onUpgrade}
          className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex-shrink-0 whitespace-nowrap"
        >
          {isFree ? "Upgrade ↗" : "Manage ↗"}
        </button>
      </div>
    </div>
  );
}

// NavContent also at module level so its identity is stable across renders.
interface NavContentProps {
  userId: string | undefined;
  plan: string;
  onMobileClose?: () => void;
  onSignOut: () => void;
  onUpgrade: () => void;
}

function NavContent({ userId, plan, onMobileClose, onSignOut, onUpgrade }: NavContentProps) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
      isActive
        ? "bg-indigo-50 dark:bg-indigo-500/[0.12] text-indigo-700 dark:text-indigo-400 shadow-sm"
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-slate-200"
    }`;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-100 dark:border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src="https://postra-landing.vercel.app/assets/postra.png"
            alt="Postra"
            className="h-8 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Postra
          </span>
        </div>
      </div>

      {/* Instagram strip */}
      <div className="pt-3 flex-shrink-0">
        <InstagramStrip userId={userId} />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={onMobileClose}>
            {({ isActive }) => (
              <>
                <span className={`transition-colors ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: settings + sign out + plan */}
      <div className="flex-shrink-0 border-t border-slate-100 dark:border-white/[0.06] pt-2">
        <div className="px-3 space-y-0.5 mb-1">
          {bottomItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass} onClick={onMobileClose}>
              {({ isActive }) => (
                <>
                  <span className={`transition-colors ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 group"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>

        <PlanStrip plan={plan} onUpgrade={onUpgrade} />
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [plan, setPlan] = useState("free");

  // Runs once on mount — fetches user id + plan
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase
        .from("user_profile")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.plan) setPlan(data.plan);
        });
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleUpgrade = () => navigate("/upgrade", { state: { plan } });

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white dark:bg-[#1a1d27] border-r border-slate-100 dark:border-white/[0.06] fixed left-0 top-0 z-30 transition-colors duration-200">
        <NavContent
          userId={userId}
          plan={plan}
          onSignOut={handleSignOut}
          onUpgrade={handleUpgrade}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 dark:bg-black/60 z-40 lg:hidden" onClick={onMobileClose} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-[#1a1d27] z-50 shadow-2xl lg:hidden flex flex-col transition-colors duration-200">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <img
                  src="https://postra-landing.vercel.app/assets/postra.png"
                  alt="Postra"
                  className="h-7 w-auto"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="font-bold text-slate-900 dark:text-white">Postra</span>
              </div>
              <button
                onClick={onMobileClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavContent
                userId={userId}
                plan={plan}
                onMobileClose={onMobileClose}
                onSignOut={handleSignOut}
                onUpgrade={handleUpgrade}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}