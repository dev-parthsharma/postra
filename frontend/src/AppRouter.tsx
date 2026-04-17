// frontend/src/AppRouter.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import OnboardingModal from "./components/OnboardingModal";
import UpdatePassword from "./pages/UpdatePassword";
import { supabase } from "./lib/supabase";
import DashboardLayout from "./components/layout/DashboardLayout";
import IdeasPage from "./pages/Ideas";
import Chat from "./pages/Chat";

// ── Placeholder page for unbuilt routes ──────────────────────────────────────
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🚧</div>
        <h2 className="text-xl font-semibold text-slate-700">{title}</h2>
        <p className="text-slate-400 text-sm mt-1">Coming soon</p>
      </div>
    </div>
  );
}

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
function HomeWithOnboarding() {
  const { user } = useAuth();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("onboarding") === "true") {
      setShowOnboarding(true);
      return;
    }

    if (!user) return;

    const checkProfile = async () => {
      const { data: profile } = await supabase
        .from("user_profile")
        .select("id, niche")
        .eq("id", user.id)
        .single();

      if (!profile || !profile.niche) {
        setShowOnboarding(true);
      }
    };

    checkProfile();
  }, [location.search, user]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    window.history.replaceState({}, "", "/dashboard");
  };

  return (
    <>
      <Dashboard />
      {showOnboarding && user && (
        <OnboardingModal userId={user.id} onComplete={handleOnboardingComplete} />
      )}
    </>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* Protected — redirect old / to /dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />

        {/* Dashboard (home) — also handles ?onboarding=true */}
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

        {/* ── Chat — sits inside DashboardLayout so sidebar is visible ── */}
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

        {/* Placeholder routes */}
        <Route path="/drafts" element={<ProtectedRoute><PlaceholderPage title="Drafts" /></ProtectedRoute>} />
        <Route path="/scheduled" element={<ProtectedRoute><PlaceholderPage title="Scheduled" /></ProtectedRoute>} />
        <Route path="/published" element={<ProtectedRoute><PlaceholderPage title="Published" /></ProtectedRoute>} />
        <Route path="/workflows" element={<ProtectedRoute><PlaceholderPage title="Workflows" /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><PlaceholderPage title="Settings" /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}