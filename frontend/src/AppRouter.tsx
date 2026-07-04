// frontend/src/AppRouter.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import OnboardingModal from "./components/OnboardingModal";
import LanguagePreferenceModal from "./components/LanguagePreferenceModal";
import UpdatePassword from "./pages/UpdatePassword";
import { supabase } from "./lib/supabase";
import DashboardLayout from "./components/layout/DashboardLayout";
import IdeasPage from "./pages/Ideas";
import Chat from "./pages/Chat";
import DraftsPage from "./pages/Drafts";
import ScheduledPage from "./pages/Scheduled";
import PublishedPage from "./pages/Published";
import CalendarPage from "./pages/Calendar";
import SettingsPage from "./pages/Settings";
import AutomationsPage from "./pages/Automations";
import UpgradePage from "./pages/Upgrade";
import MediaPage from "./pages/Media";
import Referrals from "./pages/Referrals";
import OnboardingReferralModal from "./components/ReferralModal";

// ── ProtectedRoute ────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 animate-pulse flex items-center justify-center">
            <img
              src="https://postra-landing.vercel.app/assets/postra.png"
              alt="Postra"
              className="h-6 w-auto brightness-0 invert"
            />
          </div>
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// ── HomeWithOnboarding ────────────────────────────────────────────────────────
// Shows onboarding modal for new users.
// Language preference modal is shown ONCE right after onboarding completes — never again.
// frontend/src/AppRouter.tsx

function HomeWithOnboarding() {
  const { user } = useAuth();
  const location = useLocation();
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState("english");

  useEffect(() => {
    if (!user) return;

    const checkProfileProgress = async () => {
      console.log("Checking progress for user:", user.id);

      // Fetch user profile cleanly using maybeSingle()
      const { data: profile, error } = await supabase
        .from("user_profile")
        .select("niche, content_goal, referral_step_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Database query error:", error);
        return;
      }

      console.log("Profile data retrieved:", profile);

      if (!profile) {
        console.log("Profile row is still null. Trigger may still be executing.");
        return;
      }

      // ── Step 1: Run referral code prompt if not completed or skipped yet ──
      if (!profile.referral_step_completed) {
        console.log("Referral step is not completed. Showing ReferralModal.");
        setShowReferralModal(true);
        return;
      }

      // ── Step 2: Run onboarding if profile values are incomplete ──
      if (!profile.niche || !profile.content_goal) {
        console.log("Profile niche or goal is missing. Showing OnboardingModal.");
        setShowOnboarding(true);
        return;
      }

      console.log("Onboarding is fully complete. Bypassing modals.");
    };

    checkProfileProgress();
  }, [location.search, user]);

  const handleReferralComplete = () => {
    setShowReferralModal(false);
    // Move to next onboarding steps automatically
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    
    // Clear URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete("onboarding");
    window.history.replaceState({}, "", url.toString());

    // ── Step 3: Run language setup immediately after onboarding completes ──
    if (user) {
      const { data: profile } = await supabase
        .from("user_profile")
        .select("preferred_language")
        .eq("id", user.id)
        .single();
      setCurrentLanguage(profile?.preferred_language ?? "english");
      setTimeout(() => setShowLanguageModal(true), 400);
    }
  };

  const handleLanguageModalClose = () => {
    setShowLanguageModal(false);
  };

  return (
    <>
      <Dashboard />
      
      {/* Step 1: Referral Check */}
      {showReferralModal && user && (
        <OnboardingReferralModal userId={user.id} onComplete={handleReferralComplete} />
      )}

      {/* Step 2: Onboarding Survey */}
      {showOnboarding && user && !showReferralModal && (
        <OnboardingModal userId={user.id} onComplete={handleOnboardingComplete} />
      )}

      {/* Step 3: One-time Language Setup */}
      {showLanguageModal && user && !showOnboarding && !showReferralModal && (
        <LanguagePreferenceModal
          userId={user.id}
          currentLanguage={currentLanguage}
          onClose={handleLanguageModalClose}
        />
      )}
    </>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function AppRouter() {
  // Capture referral links on first page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref") || params.get("referral");
    if (refCode) {
      localStorage.setItem("postra_captured_ref_code", refCode.trim().toUpperCase());
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        
        {/* Referrals */}
        <Route
          path="/referrals"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Referrals />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected — redirect / to /dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <HomeWithOnboarding />
            </ProtectedRoute>
          }
        />

        {/* Ideas */}
        <Route
          path="/ideas"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <IdeasPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/media"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MediaPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Chat */}
        <Route
          path="/chat/:chatId"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Chat />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Drafts */}
        <Route
          path="/drafts"
          element={
            <ProtectedRoute>
              <DraftsPage />
            </ProtectedRoute>
          }
        />

        {/* Scheduled */}
        <Route
          path="/scheduled"
          element={
            <ProtectedRoute>
              <ScheduledPage />
            </ProtectedRoute>
          }
        />

        {/* Published */}
        <Route
          path="/published"
          element={
            <ProtectedRoute>
              <PublishedPage />
            </ProtectedRoute>
          }
        />

        {/* Calendar */}
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />

        {/* Old /workflows redirect → /calendar */}
        <Route path="/workflows" element={<Navigate to="/calendar" replace />} />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Automations */}
        <Route
          path="/automations"
          element={
            <ProtectedRoute>
              <AutomationsPage />
            </ProtectedRoute>
          }
        />

        {/* Upgrade */}
        <Route
          path="/upgrade"
          element={
            <ProtectedRoute>
              <UpgradePage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}