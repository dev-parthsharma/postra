// frontend/src/pages/Automations.tsx
import DashboardLayout from "../components/layout/DashboardLayout";

export default function AutomationsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automations</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Set up smart workflows to automate your posting routine.
          </p>
        </div>

        {/* Empty state */}
        <div className="bg-white dark:bg-[#1a1d27] border border-slate-100 dark:border-white/[0.06] rounded-2xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-indigo-400 dark:text-indigo-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-1.5">No automations yet</h2>
            <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs leading-relaxed">
              Automate scheduling, idea generation, and consistency tracking — hands-free. Coming soon.
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Teaser cards */}
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          {[
            { icon: "📅", title: "Auto-schedule posts", description: "Send ready posts at the best time automatically." },
            { icon: "💡", title: "Weekly idea drops", description: "Get 3 fresh AI ideas delivered every Monday." },
            { icon: "🔁", title: "Repurpose content", description: "Turn a published post into a new format." },
            { icon: "📊", title: "Streak protection", description: "Get reminded to post before your streak breaks." },
          ].map((item) => (
            <div key={item.title} className="bg-white dark:bg-[#1a1d27] border border-slate-100 dark:border-white/[0.06] rounded-xl p-4 shadow-sm opacity-40 select-none">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}