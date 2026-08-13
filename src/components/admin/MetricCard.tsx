import type { LucideIcon } from "lucide-react";

export default function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "violet",
}: {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone?: "violet" | "blue" | "green" | "amber";
}) {
  const tones = {
    violet: "bg-violet-500/12 text-violet-300 ring-violet-400/20",
    blue: "bg-blue-500/12 text-blue-300 ring-blue-400/20",
    green: "bg-emerald-500/12 text-emerald-300 ring-emerald-400/20",
    amber: "bg-amber-500/12 text-amber-300 ring-amber-400/20",
  };

  return (
    <article className="rounded-xl border border-white/[0.07] bg-[#181822] p-4 shadow-[0_18px_50px_rgba(0,0,0,.16)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ring-1 ${tones[tone]}`}><Icon size={16} /></span>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-100">{value}</p>
      <p className="mt-2 text-xs text-emerald-400">{change} <span className="text-slate-500">vs last month</span></p>
    </article>
  );
}
