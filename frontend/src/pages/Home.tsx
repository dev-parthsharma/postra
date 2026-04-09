import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

function Home() {
  const { session, loading, logout } = useAuth();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchWelcome = async () => {
      const response = await fetch("/api/supabase-test");
      const data = await response.json();
      setMessage(data.message ?? "Unable to verify connection.");
    };

    fetchWelcome().catch(() => {
      setMessage("Unable to verify API connection.");
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-4 py-10">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-10 shadow-lg shadow-slate-300/20">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Postra</p>
            <h1 className="mt-3 text-4xl font-bold text-slate-900">SaaS-ready MVP scaffold</h1>
            <p className="mt-4 max-w-2xl text-slate-600">Clean frontend and backend architecture with Supabase auth, FastAPI services, and scalable folder layout.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-slate-700">Backend health: <span className="font-semibold text-slate-900">{message || "Loading..."}</span></p>
          </div>

          <div className="flex flex-wrap gap-4">
            {loading ? (
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">Loading auth…</span>
            ) : session ? (
              <>
                <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm text-emerald-700">Signed in as {session.user.email}</span>
                <button onClick={logout} className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white transition hover:bg-sky-700">
                  Login
                </Link>
                <Link to="/signup" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 transition hover:bg-slate-100">
                  Signup
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
