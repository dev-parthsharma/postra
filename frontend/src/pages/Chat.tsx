// frontend/src/pages/Chat.tsx
// Simplified V2: Direct wrapper for the full-screen Post Preview & Editor Dashboard

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import InstagramPreview from "../components/InstagramPreview";

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  // Load user plan on mount
  useEffect(() => {
    if (!user) return;
    const fetchPlan = async () => {
      try {
        const { data } = await supabase
          .from("user_profile")
          .select("plan")
          .eq("id", user.id)
          .single();
        if (data?.plan) {
          setPlan(data.plan.toLowerCase());
        }
      } catch (err) {
        console.error("Failed to load user plan inside wrapper:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden">
      {/* 🟢 Direct InstagramPreview Render: No duplicate editors or nested layouts */}
      <InstagramPreview chatId={chatId} plan={plan} />
    </div>
  );
}