import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logo from "../assets/postra-logo.png";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Determine configuration settings based on redirect params
  const modeParam = searchParams.get("mode") === "create" ? "create" : "reset";
  const emailParam = searchParams.get("email") || "";

  const [mode, setMode] = useState<"reset" | "create">(modeParam);
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Send OTP, 2: Enter OTP, 3: Create Password, 4: Success
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(modeParam);
    if (emailParam) setEmail(emailParam);
  }, [modeParam, emailParam]);

  // Flow A: Recover/Reset Password link
  const handleResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) throw resetError;
      setMessage("Password reset email sent successfully!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error sending password reset email.");
    } finally {
      setLoading(false);
    }
  };

  // Flow B - Step 1: Request Email-OTP code
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Prevent new registrations through this portal
        },
      });

      if (otpError) throw otpError;
      setStep(2);
      setMessage("A 6-digit verification code has been sent to your inbox.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to trigger verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Flow B - Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (verifyError) throw verifyError;
      setStep(3);
      setMessage("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Flow B - Step 3: Set and Apply Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
        
        <div className="flex flex-col items-center space-y-2">
          <img src={logo} alt="Postra" className="w-12 h-12 object-contain" />
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {mode === "create" ? "Setup Password" : "Reset Password"}
          </h1>
          <p className="text-zinc-500 text-sm text-center px-4">
            {mode === "create" 
              ? "Verify your email with an OTP code to establish a login password."
              : "Enter your email address to get a secure account recovery link."}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}
        {message && !error && (
          <div className="p-3.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-sm font-medium">
            {message}
          </div>
        )}

        {/* MODE A: Reset Recovery flow */}
        {mode === "reset" && (
          <form onSubmit={handleResetLink} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:outline-none text-zinc-900 text-sm"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
            >
              {loading ? "Processing..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {/* MODE B: Safe OTP Password Creation flow */}
        {mode === "create" && (
          <>
            {step === 1 && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:outline-none text-zinc-900 text-sm"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
                >
                  {loading ? "Sending Code..." : "Send Verification Code"}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter Code"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:outline-none text-center text-zinc-900 font-mono text-lg tracking-widest"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    className="text-xs text-purple-600 hover:underline font-semibold"
                  >
                    Resend Code
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleSavePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong password"
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
                    placeholder="Verify password choice"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:outline-none text-zinc-900 text-sm"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
                >
                  {loading ? "Registering..." : "Save Password & Login"}
                </button>
              </form>
            )}

            {step === 4 && (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-200">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-zinc-900">All Set!</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    Your password has been set. You are now logged in.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </>
        )}

        {step !== 4 && (
          <div className="border-t border-zinc-200 pt-4 flex justify-between text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMessage("");
                setMode(mode === "reset" ? "create" : "reset");
                setStep(1);
              }}
              className="text-purple-600 hover:text-purple-500 transition-colors"
            >
              {mode === "reset" ? "Create Account Password" : "Standard Recovery"}
            </button>
            <Link to="/login" className="text-zinc-500 hover:text-zinc-700 transition-colors">
              Back to Login
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}