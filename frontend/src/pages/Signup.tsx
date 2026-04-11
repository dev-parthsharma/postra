import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import AuthForm, { AuthFormData } from "../components/AuthForm";
import logo from "../assets/postra-logo.png";

export default function Signup() {
  const { signUp, signInWithGoogle} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (data: AuthFormData) => {
    setError(null);
    setLoading(true);
    try {
      await signUp(data.email, data.password, data.fullName);
      setSuccess(true);
      // If email confirmation is disabled in Supabase → onAuthStateChange fires
      // automatically and the onboarding popup shows from AppRouter / Home page.
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

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── LEFT: Branding ── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-white" />
        <div className="absolute -top-40 right-0 w-[500px] h-[500px] bg-purple-100 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-10 w-[300px] h-[300px] bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />

        {/* Logo */}
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

        {/* Hero copy */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-purple-600 text-xs font-medium">Join 2,000+ creators</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold text-zinc-900 leading-tight tracking-tight">
            Your first post is<br />
            <span className="text-purple-600">5 minutes away.</span>
          </h1>

          <p className="text-zinc-600 text-sm leading-relaxed max-w-xs">
            Get instant access to AI-powered ideas, scripts, captions, and smart scheduling. No credit card needed.
          </p>

          {/* Steps */}
          <div className="space-y-3">
            {[
              { icon: "💡", text: "Tell Postra your niche & tone" },
              { icon: "📝", text: "Get 3 trending ideas instantly" },
              { icon: "🚀", text: "Script, caption & post in minutes" },
            ].map((s) => (
              <div key={s.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-zinc-300 flex items-center justify-center text-sm shrink-0">
                  {s.icon}
                </div>
                <span className="text-zinc-700 text-sm">{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 p-5 rounded-2xl bg-white border border-zinc-300 backdrop-blur-sm space-y-3">
          <div className="flex gap-0.5 text-purple-600 text-sm">★★★★★</div>
          <p className="text-zinc-700 text-sm leading-relaxed">
            "The script generator is insane. I described my idea in two sentences and got a reel script I actually used word-for-word. My views tripled."
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-zinc-900 shrink-0">PS</div>
            <div>
              <p className="text-zinc-900 text-xs font-semibold">Payal Sharma</p>
              <p className="text-zinc-500 text-xs">@payalsharma · 8.1K followers</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-12">
        {/*logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center shadow-lg shadow-md">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <span className="text-zinc-900 font-bold text-lg tracking-tight">Postra</span>
        </div>

        <div className="w-full max-w-sm">
          {success ? (
            /* ── Email confirmation sent ── */
            <div className="text-center space-y-5 py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center">
                <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-zinc-900">Check your inbox</h2>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  We've sent a confirmation link to your email. Click it to activate your account.
                </p>
              </div>
              <Link to="/login" className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-300 text-sm font-medium transition-colors">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Heading */}
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Create your account</h2>
                <p className="text-zinc-600 text-sm mt-1">
                  Already have one?{" "}
                  <Link to="/login" className="text-purple-600 hover:text-purple-400 font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>

              {/* Free trial badge */}
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-100 border border-purple-300">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-black text-xs font-medium">14-day free trial · No credit card required</span>
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
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-zinc-600 text-xs">or with email</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {/* Form */}
              <AuthForm mode="signup" onSubmit={handleSubmit} error={error} loading={loading} />

              <p className="text-center text-xs text-zinc-700">
                By signing up you agree to our{" "}
                <a href="#" className="underline hover:text-zinc-500 transition-colors">Terms</a> &{" "}
                <a href="#" className="underline hover:text-zinc-500 transition-colors">Privacy Policy</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}