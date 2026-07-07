// frontend\src\pages\Login.tsx

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import AuthForm, { AuthFormData } from "../components/AuthForm";
import logo from "../assets/postra-logo.png";
import { supabase } from "../lib/supabase";

export default function Login() {
  const { signIn, signInWithGoogle, user, loading } = useAuth(); // Destructured user and loading
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loadingForm, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);
  
  // Real-time status states
  const [typedEmail, setTypedEmail] = useState(""); // Track email input
  const [noPasswordUser, setNoPasswordUser] = useState<{ email: string } | null>(null);
  const [emailChecked, setEmailChecked] = useState<string | null>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  // ── OTP Overlay States ───────────────────────────────────────────────────
  const [showOtpOverlay, setShowOtpOverlay] = useState(false);
  const [otpModalMode, setOtpModalMode] = useState<"create" | "reset">("create"); // Dynamic title context
  const [otpStep, setOtpStep] = useState<1 | 2 | 3 | 4>(1); // 1: Send OTP, 2: Verify Code, 3: Set Password, 4: Success
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ── Redirect on Mount if Session is Already Active ──
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // Real-time typed check
  const handleEmailChange = async (email: string) => {
    setTypedEmail(email); // Track as they type
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(null);
      setNoPasswordUser(null);
      setEmailChecked(null);
      return;
    }

    if (emailRegex.test(trimmedEmail)) {
      if (emailChecked === trimmedEmail.toLowerCase()) return;

      setStatusChecking(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const checkResp = await fetch(`${API_URL}/api/auth/check-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail }),
        });

        if (checkResp.ok) {
          const status = await checkResp.json();
          setEmailChecked(trimmedEmail.toLowerCase());

          if (!status.exists) {
            setError("No user found. Please create an account.");
            setNoPasswordUser(null);
          } else if (status.exists && !status.has_password) {
            setNoPasswordUser({ email: trimmedEmail });
            setError("Google account found. You have not created an email password yet.");
          } else {
            setError(null);
            setNoPasswordUser(null);
          }
        }
      } catch (err) {
        console.error("Silent verification failed:", err);
      } finally {
        setStatusChecking(false);
      }
    } else {
      setError(null);
      setNoPasswordUser(null);
    }
  };

  // Focus-fallback check
  const handlePasswordFocus = async (email: string) => {
    setTypedEmail(email);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    if (emailChecked === trimmedEmail.toLowerCase()) return;

    setError(null);
    setNoPasswordUser(null);
    setStatusChecking(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const checkResp = await fetch(`${API_URL}/api/auth/check-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (checkResp.ok) {
        const status = await checkResp.json();
        setEmailChecked(trimmedEmail.toLowerCase());

        if (!status.exists) {
          setError("No user found. Please create an account.");
        } else if (status.exists && !status.has_password) {
          setNoPasswordUser({ email: trimmedEmail });
          setError("Google account found. You have not created an email password yet.");
        } else {
          setError(null);
        }
      }
    } catch (err) {
      console.error("Focus verification failed:", err);
    } finally {
      setStatusChecking(false);
    }
  };

  const handleSubmit = async (data: AuthFormData) => {
    setError(null);
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      const { data: { user } } = await supabase.auth.getUser();
          
      if (!user) {
        navigate("/login");
        return;
      }
      
      const { data: profile } = await supabase
        .from("user_profile")
        .select("niche")
        .eq("id", user.id)
        .single();
      
      if (!profile || !profile.niche) {
        navigate("/?onboarding=true");
      } else {
        navigate("/dashboard");
      }
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

  // ── Forgot Password Button Click ─────────────────────────────────────────
  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const trimmed = typedEmail.trim();
    if (!trimmed || !emailRegex.test(trimmed)) {
      setError("Please enter a valid email address first to reset your password.");
      return;
    }
    setNoPasswordUser({ email: trimmed });
    setOtpModalMode("reset");
    setOtpStep(1);
    setOtpError(null);
    setOtpMessage("");
    setOtpCode("");
    setShowOtpOverlay(true);
  };

  // ── OTP Overlay Actions ──────────────────────────────────────────────────
  const handleRequestOTP = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!noPasswordUser) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: noPasswordUser.email,
        options: { shouldCreateUser: false },
      });
      if (otpError) throw otpError;
      setOtpStep(2);
      setOtpMessage("A 6-digit verification code was sent to your email.");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noPasswordUser || otpCode.length < 6) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: noPasswordUser.email,
        token: otpCode,
        type: "email",
      });
      if (verifyError) throw verifyError;
      setOtpStep(3);
      setOtpMessage("");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Invalid or expired verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side complexity checks before sending to server
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (newPassword.length < 8 || !hasLowercase || !hasUppercase || !hasNumber) {
      setOtpError("Password does not meet complexity requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setOtpError("Passwords do not match.");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setOtpStep(4);
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to register password.");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Render Styled Errors ──────────────────────────────────────────────────
  const renderOtpError = (err: string | null) => {
    if (!err) return null;

    const isComplexityError = 
      err.includes("complexity") || 
      err.includes("Password should contain") || 
      err.includes("Password should be at least");

    return (
      <div className="mx-6 mt-4 p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
        <svg className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div className="space-y-1.5 text-xs text-rose-600 leading-normal">
          {isComplexityError ? (
            <>
              <p className="font-bold text-rose-700">Weak Password Format</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-600/95 font-medium">
                <li>Minimum 8 characters long</li>
                <li>At least one lowercase letter (a-z)</li>
                <li>At least one uppercase letter (A-Z)</li>
                <li>At least one digit (0-9)</li>
              </ul>
            </>
          ) : (
            <p className="font-semibold">{err}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── LEFT: Branding panel ── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden">
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
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Welcome back</h2>
            <p className="text-zinc-600 text-sm mt-1">
              No account?{" "}
              <Link to="/signup" className="text-purple-600 hover:text-purple-400 font-medium transition-colors">
                Sign up free
              </Link>
            </p>
          </div>

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

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-500" />
            <span className="text-zinc-500 text-xs">or continue with email</span>
            <div className="flex-1 h-px bg-zinc-500" />
          </div>

          <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-2xl border border-zinc-300 shadow-sm relative">
            {statusChecking && (
              <div className="flex items-center gap-2 text-xs text-purple-600 font-semibold mb-3 animate-pulse">
                <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking account status...
              </div>
            )}
            
            <AuthForm 
              mode="login" 
              onSubmit={handleSubmit} 
              error={error} 
              loading={loadingForm} 
              onPasswordFocus={handlePasswordFocus}
              onEmailChange={handleEmailChange}
              passwordDisabled={!!noPasswordUser}
              noPasswordMode={!!noPasswordUser}
              onCreatePasswordClick={() => {
                if (noPasswordUser) {
                  setOtpModalMode("create");
                  setOtpStep(1);
                  setOtpError(null);
                  setOtpMessage("");
                  setOtpCode("");
                  setShowOtpOverlay(true);
                }
              }}
            />
          </div>

          {/* Trigger OTP flow for Password Resets */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleForgotPasswordClick}
              className="text-xs text-zinc-600 hover:text-zinc-600 transition-colors outline-none focus:underline"
            >
              Forgot your password?
            </button>
          </div>

          <p className="text-xs text-zinc-500 hover:text-purple-600">
            By continuing you agree to our{" "}
            <a href="#" className="underline hover:text-zinc-500 transition-colors">Terms</a> &{" "}
            <a href="#" className="underline hover:text-zinc-500 transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>

      {/* ── STEP-BY-STEP OTP VERIFICATION OVERLAY ── */}
      {showOtpOverlay && noPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 text-center border-b border-zinc-150 relative">
              <button
                type="button"
                onClick={() => setShowOtpOverlay(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-50 transition"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img src={logo} alt="Postra" className="w-10 h-10 mx-auto object-contain mb-2" />
              <h3 className="text-lg font-bold text-zinc-900">
                {otpModalMode === "create" ? "Setup Account Password" : "Reset Account Password"}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {otpModalMode === "create" ? "Creating password for" : "Resetting password for"} {noPasswordUser.email}
              </p>
            </div>

            {/* Error Message Layout */}
            {renderOtpError(otpError)}

            {/* Message Banners */}
            {otpMessage && !otpError && (
              <div className="mx-6 mt-4 p-3 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold rounded-xl">
                {otpMessage}
              </div>
            )}

            {/* Step Content */}
            <div className="p-6">
              
              {/* Step 1: Send Verification Code */}
              {otpStep === 1 && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 leading-relaxed text-center">
                    To make sure it's you, we will send a 6-digit verification code to your email address.
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    disabled={otpLoading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : "Send Verification Code"}
                  </button>
                </div>
              )}

              {/* Step 2: Input & Verify Code */}
              {otpStep === 2 && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">OTP Verification Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit Code"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:outline-none text-center text-zinc-900 font-mono text-lg tracking-widest"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length < 6}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : "Verify Code"}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleRequestOTP}
                      className="text-xs text-purple-600 hover:underline font-semibold"
                    >
                      Resend Code
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Set Password */}
              {otpStep === 3 && (
                <form onSubmit={handleSavePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 chars, case & numbers"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:outline-none text-zinc-900 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Confirm Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:outline-none text-zinc-900 text-sm"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : "Save Password & Login"}
                  </button>
                </form>
              )}

              {/* Step 4: Success Completion */}
              {otpStep === 4 && (
                <div className="text-center space-y-4 animate-in fade-in zoom-in-95">
                  <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-200 shadow-sm">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-zinc-900">Password Setup Complete</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed px-4">
                      Your login credentials have been configured successfully.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOtpOverlay(false);
                      navigate("/dashboard");
                    }}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm transition-all"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}