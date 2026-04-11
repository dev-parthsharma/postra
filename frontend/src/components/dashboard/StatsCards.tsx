// frontend/src/components/dashboard/StatsCards.tsx
interface StatsCardsProps {
  postsThisMonth: number;
  savedWorkflows: number;
  ideasSaved: number;
  loading: boolean;
}

interface StatCardProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  accentClass: string;
  loading: boolean;
}

function StatCard({ value, label, icon, accentClass, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentClass}`}>
        {icon}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-9 w-16 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <div>
          <div className="text-4xl font-bold text-slate-900 tracking-tight leading-none mb-1">
            {value}
          </div>
          <div className="text-sm text-slate-500 font-medium">{label}</div>
        </div>
      )}
    </div>
  );
}

export default function StatsCards({ postsThisMonth, savedWorkflows, ideasSaved, loading }: StatsCardsProps) {
  const stats = [
    {
      value: postsThisMonth,
      label: "Posts this month",
      accentClass: "bg-indigo-50",
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-indigo-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      value: savedWorkflows,
      label: "Saved workflows",
      accentClass: "bg-violet-50",
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-violet-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      value: ideasSaved,
      label: "Ideas saved",
      accentClass: "bg-amber-50",
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-amber-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} loading={loading} />
      ))}
    </div>
  );
}