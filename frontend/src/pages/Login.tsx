import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import AuthForm, { AuthFormData } from "../components/AuthForm";
import logo from "../assets/postra-logo.png";

export default function Login() {
  const { signIn, signInWithGoogle, signInWithFacebook } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

  const handleSubmit = async (data: AuthFormData) => {
    setError(null);
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading("google");
    try { await signInWithGoogle(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "OAuth error."); setOauthLoading(null); }
  };

  const handleFacebook = async () => {
    setOauthLoading("facebook");
    try { await signInWithFacebook(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "OAuth error."); setOauthLoading(null); }
  };

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── LEFT: Branding panel ── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-white" />
        <div className="absolute -top-40 -left-20 w-[500px] h-[500px] bg-purple-100 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-10 w-[350px] h-[350px] bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <img
            src={logo}
            alt="Postra"
            className="w-15 h-12 object-contain"
          />
          <span className="text-zinc-800 font-bold text-3xl tracking-tight">
            Postra
          </span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-200 border border-purple-300">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-purple-600 text-xs font-medium">AI-powered content system</span>
          </div>

          <h1 className="text-5xl xl:text-6xl font-bold text-zinc-900 leading-[1.1] tracking-tight">
            Stop overthinking.<br />
            <span className="text-purple-600">Start posting.</span>
          </h1>
                  
          <p className="text-zinc-600 text-lg leading-relaxed max-w-md">
            From idea to published post in minutes — scripts, captions, hashtags, and schedules, all AI-generated.
          </p>

          {/* Social proof avatars */}
          <div className="flex items-center gap-3">
            <div className="flex">
              {[
                { initials: "SP", bg: "#2b1571" },
                { initials: "SK", bg: "#3e228d" },
                { initials: "AC", bg: "#652fab" },
                { initials: "PS", bg: "#9542e3" },
              ].map((av, i) => (
                <div
                  key={av.initials}
                  className="w-8 h-8 rounded-full border-2 border-zinc-950 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: av.bg, marginLeft: i === 0 ? 0 : -8 }}
                >
                  {av.initials}
                </div>
              ))}
            </div>
            <div>
              <p className="text-zinc-900 text-sm font-semibold">2,000+ creators</p>
              <p className="text-zinc-500 text-xs">posting consistently with Postra</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { value: "14K+", label: "Posts created" },
            { value: "5 min", label: "Avg. to script" },
            { value: "4.9★", label: "Rating" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-zinc-900 text-xl font-bold">{s.value}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-12 bg-zinc-50">
        {/* Mobile logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src={logo}
            alt="Postra"
            className="w-10 h-10 object-contain"
          />
          <span className="text-zinc-900 font-bold text-xl tracking-tight">
            Postra
          </span>
        </div>

        <div className="w-full max-w-sm space-y-6">

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Welcome back</h2>
            <p className="text-zinc-600 text-sm mt-1">
              No account?{" "}
              <Link to="/signup" className="text-purple-600 hover:text-purple-400 font-medium transition-colors">
                Sign up free
              </Link>
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button" onClick={handleGoogle}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white border border-zinc-400 hover:border-zinc-500 hover:bg-zinc-50 text-zinc-900 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === "google" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>

            <button
              type="button" onClick={handleFacebook}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white border border-zinc-400 hover:border-zinc-500 hover:bg-zinc-50 text-zinc-900 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === "facebook" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              Continue with Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-500" />
            <span className="text-zinc-500 text-xs">or continue with email</span>
            <div className="flex-1 h-px bg-zinc-500" />
          </div>

          {/* Email form */}
          <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-2xl border border-zinc-300 shadow-sm">
          <AuthForm mode="login" onSubmit={handleSubmit} error={error} loading={loading} />
          </div>

          {/* Forgot */}
          <div className="text-center">
            <Link to="/forgot-password" className="text-xs text-zinc-600 hover:text-zinc-600 transition-colors">
              Forgot your password?
            </Link>
          </div>

          <p className="text-xs text-zinc-500 hover:text-purple-600">
            By continuing you agree to our{" "}
            <a href="#" className="underline hover:text-zinc-500 transition-colors">Terms</a> &{" "}
            <a href="#" className="underline hover:text-zinc-500 transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}