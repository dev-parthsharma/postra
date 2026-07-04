// frontend/src/pages/Referrals.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getReferralDashboard } from "../lib/referralApi";

interface Referral {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface Reward {
  id: string;
  reward_type: string;
  status: string;
  duration_days: number;
  discount_percent: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
}

interface DashboardData {
  referral_code: string;
  referral_link: string;
  metrics: {
    total_referrals: number;
    successful_referrals: number;
    active_extensions: number;
  };
  referrals: Referral[];
  rewards_queue: Reward[];
}

export default function Referrals() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const dashboard = await getReferralDashboard();
        setData(dashboard);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCopyLink = () => {
    if (!data?.referral_link) return;
    navigator.clipboard.writeText(data.referral_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <span className="text-slate-400 text-sm animate-pulse">Loading referral panel...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      
      {/* ── Page Header with Sleek Back Arrow ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition flex items-center justify-center dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
          title="Back to Dashboard"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Invite & Earn</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Grow your workspace storage and get free subscription extensions by inviting other video creators.
          </p>
        </div>
      </div>

      {/* ── Referral Link Copy Card ── */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="max-w-xl space-y-6 relative z-10">
          <div>
            <h2 className="text-xl font-bold">Invite Video Creators to Postra</h2>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              Earn free monthly subscription extensions and discounts by sharing Postra with your fellow video creators, editors, and inspirations. 
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 flex items-center justify-between border border-white/10 font-mono text-sm">
              <span className="truncate">{data?.referral_link}</span>
              <span className="ml-2 font-bold px-2 py-0.5 bg-white/20 rounded text-xs uppercase tracking-wider">
                {data?.referral_code}
              </span>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl text-sm transition hover:bg-zinc-100 shrink-0 shadow-sm"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Friends Invited", value: data?.metrics.total_referrals || 0 },
          { label: "Successful Upgrades", value: data?.metrics.successful_referrals || 0 },
          { label: "Active Extensions", value: `${data?.metrics.active_extensions || 0} Days` },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Detailed Rewards Structure Matrix ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card A: What your friend gets */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-1 bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 rounded-md uppercase tracking-wider">For Your Friend</span>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">What they receive on join:</h3>
          <ul className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
            <li className="flex items-start gap-2.5">
              <span className="text-purple-600 font-semibold mt-0.5 shrink-0">✓</span>
              <span>
                <strong>10 Days of Pro Trial</strong> (instead of the standard 7 days) to experience AI scriptwriters, dynamic calendar planners, and automated publishing.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-purple-600 font-semibold mt-0.5 shrink-0">✓</span>
              <span>
                <strong>One-time 20% discount</strong> automatically applied to their first paid subscription purchase (Starter or Pro).
              </span>
            </li>
          </ul>
        </div>

        {/* Card B: What you get */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-md uppercase tracking-wider">For You</span>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">What you earn:</h3>
          <ul className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
            <li className="flex items-start gap-2.5">
              <span className="text-indigo-600 font-semibold mt-0.5 shrink-0">✓</span>
              <span>
                <strong>One-time 20% discount</strong> on your next monthly renewal.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-indigo-600 font-semibold mt-0.5 shrink-0">✓</span>
              <span>
                <strong>50% Subscription Bounty</strong>: When they make their first paid subscription, you receive 50% of their purchased plan's duration for free on that same plan!
              </span>
            </li>
          </ul>
        </div>

      </div>

      {/* ── Direct Subscription Bounty Examples ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">How the 50% Bounty Works</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          When your referred friend upgrades, your active subscription is extended, or a new plan is queued for you. 
          The reward plan matches their purchased tier exactly:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium">
          {[
            { action: "They buy 1 Month Starter", reward: "You get 15 Days of Starter" },
            { action: "They buy 1 Month Pro", reward: "You get 15 Days of Pro" },
            { action: "They buy 1 Year Starter", reward: "You get 6 Months of Starter" },
            { action: "They buy 1 Year Pro", reward: "You get 6 Months of Pro" },
          ].map((ex, i) => (
            <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 space-y-1.5">
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Example {i+1}</p>
              <p className="text-zinc-900 dark:text-white font-semibold">{ex.action}</p>
              <p className="text-indigo-600 dark:text-indigo-400 font-bold">{ex.reward} Free</p>
            </div>
          ))}
        </div>

        <div className="p-4 bg-purple-50/50 dark:bg-purple-950/15 border border-purple-100 dark:border-purple-900/30 rounded-xl">
          <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold leading-relaxed">
            Note: If you already have an active trial or subscription running, your earned extensions are queued securely in your pipeline and start automatically when your current plan or trial naturally expires.
          </p>
        </div>
      </div>

      {/* ── Active & Queued Rewards Pipeline ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-4">Your Rewards Pipeline</h3>
        {(!data?.rewards_queue || data.rewards_queue.length === 0) ? (
          <p className="text-zinc-500 text-xs text-center py-6">No rewards registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5">Incentive</th>
                  <th className="py-2.5">Value</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Valid Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 font-medium">
                {data.rewards_queue.map((reward) => (
                  <tr key={reward.id} className="text-zinc-700 dark:text-zinc-300">
                    <td className="py-3 capitalize">{reward.reward_type.replace("_", " ")}</td>
                    <td className="py-3">
                      {reward.duration_days > 0 ? `${reward.duration_days} Days` : `${reward.discount_percent}% Off`}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold ${
                        reward.status === "active" ? "bg-green-50 text-green-600 dark:bg-green-950/20" :
                        reward.status === "pending" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20" :
                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/40"
                      }`}>
                        {reward.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[10px] text-zinc-500">
                      {reward.start_at ? `${new Date(reward.start_at).toLocaleDateString()} - ${new Date(reward.end_at!).toLocaleDateString()}` : "Queued"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Invited Creators List ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-4">Friends Referred</h3>
        {(!data?.referrals || data.referrals.length === 0) ? (
          <p className="text-zinc-500 text-xs text-center py-6">No invitations registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5">Name</th>
                  <th className="py-2.5">Invited On</th>
                  <th className="py-2.5">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 font-medium">
                {data.referrals.map((friend) => (
                  <tr key={friend.id} className="text-zinc-700 dark:text-zinc-300">
                    <td className="py-3">{friend.name}</td>
                    <td className="py-3 text-zinc-500">{new Date(friend.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold ${
                        friend.status === "completed" ? "bg-green-50 text-green-600 dark:bg-green-950/20" :
                        friend.status === "applied" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/20" :
                        "bg-red-50 text-red-600 dark:bg-red-950/20"
                      }`}>
                        {friend.status === "completed" ? "Upgraded" : friend.status === "applied" ? "On Trial" : "Flagged"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}