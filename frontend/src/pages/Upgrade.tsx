// frontend/src/pages/Upgrade.tsx
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";

export default function UpgradePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Plan is passed via router state from the sidebar; fall back to "free"
  const currentPlan: string = (location.state as { plan?: string } | null)?.plan ?? "free";
  const currentPlanNorm = currentPlan.toLowerCase();

  const plans = [
    {
      key: "free",
      name: "FREE",
      price: "₹0",
      period: "forever",
      description: "For creators starting out. No card, no commitment.",
      features: [
        "3 ideas per day",
        "Captions, hashtags & hooks generation",
        "Content calendar + consistency tracking",
        "Instagram integration",
        "Up to 15 post outputs",
      ],
    },
    {
      key: "starter",
      name: "STARTER",
      price: "₹199",
      period: "/month",
      description: "For creators who want to actually post consistently.",
      features: [
        "Everything in Free",
        "Script generation",
        "Direct posting from Postra",
        "Best time to post suggestions",
        "Unlimited idea generation",
        "1 powerful regeneration, then normal",
        "Schedule up to 3 reels",
        "Up to 30 post outputs",
      ],
      highlight: false,
    },
    {
      key: "pro",
      name: "PRO",
      price: "₹399",
      period: "/month",
      description: "For creators who want speed, quality, and full workflow support.",
      features: [
        "Everything in Starter",
        "Shooting & editing guide",
        "Cover image generation",
        "Always powerful output",
        "One-click idea to post",
        "Smart calendar + consistency tracking",
        "Schedule up to 5 posts/reels",
      ],
      highlight: true,
    },
  ];

  function ctaLabel(planKey: string): string {
    if (planKey === currentPlanNorm) return "Current Plan";
    if (planKey === "free") return "Downgrade";
    return planKey === "starter" ? "Upgrade to Starter" : "Go Pro →";
  }

  function ctaDisabled(planKey: string): boolean {
    return planKey === currentPlanNorm || planKey === "free";
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Upgrade your plan</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Pick the plan that fits your creator journey.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          {plans.map((plan) => {
            const isCurrent = plan.key === currentPlanNorm;
            const disabled = ctaDisabled(plan.key);

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-6 flex flex-col shadow-sm transition-all ${
                  plan.highlight
                    ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-indigo-100 dark:shadow-indigo-500/10 shadow-lg"
                    : isCurrent
                    ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/[0.06]"
                    : "border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#1a1d27]"
                }`}
              >
                {/* Badges */}
                {plan.highlight && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow">
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow">
                      Your Plan
                    </span>
                  </div>
                )}

                {/* Plan info */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                    <span className="text-slate-400 dark:text-slate-500 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">{plan.description}</p>
                </div>

                {/* Features */}
                <div className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-indigo-500 mt-0.5 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  type="button"
                  disabled={disabled}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                    disabled
                      ? isCurrent
                        ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-default"
                        : "bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 cursor-default"
                      : plan.highlight
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-500/20"
                      : "bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-white"
                  }`}
                >
                  {ctaLabel(plan.key)}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="text-center">
          <p className="text-slate-400 dark:text-slate-500 text-xs">
            Payment system coming soon. Upgrade options will be live shortly.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-3 text-indigo-500 hover:text-indigo-700 text-sm font-medium transition-colors"
          >
            ← Go back
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}