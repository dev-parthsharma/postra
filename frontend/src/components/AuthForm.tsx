import { useState } from "react";

export interface AuthFormData {
  email: string;
  password: string;
  fullName?: string;
}

interface Props {
  mode: "login" | "signup";
  onSubmit: (data: AuthFormData) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}

export default function AuthForm({ mode, onSubmit, error, loading }: Props) {
  const [form, setForm] = useState<AuthFormData>({ email: "", password: "", fullName: "" });
  const [showPw, setShowPw] = useState(false);
  const isSignup = mode === "signup";

  const set = (key: keyof AuthFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(form); };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 w-full">
      {isSignup && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className="text-sm font-medium text-black">Full name</label>
          <input
            id="fullName" name="fullName" type="text" autoComplete="name"
            required value={form.fullName} onChange={set("fullName")}
            placeholder="Parth Sharma"
            className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-400 text-zinc-900 text-sm placeholder-zinc-450 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-black">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="email"
          required value={form.email} onChange={set("email")}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-black">Password</label>
        <div className="relative">
          <input
            id="password" name="password"
            type={showPw ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required value={form.password} onChange={set("password")}
            placeholder={isSignup ? "Min. 8 characters" : "••••••••"}
            className="w-full px-4 py-3 pr-11 rounded-xl bg-white border border-zinc-400 text-zinc-900 text-sm placeholder-zinc-450 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
          />
          <button
            type="button" onClick={() => setShowPw((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 transition-colors p-1"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold text-sm tracking-wide shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {isSignup ? "Creating account…" : "Signing in…"}
          </>
        ) : isSignup ? "Create account →" : "Sign in →"}
      </button>
    </form>
  );
}