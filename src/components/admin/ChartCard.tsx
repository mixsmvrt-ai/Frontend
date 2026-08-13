import type { ReactNode } from "react";

export default function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/[0.07] bg-[#181822] p-5 shadow-[0_18px_50px_rgba(0,0,0,.14)] ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <button className="text-xs font-medium text-slate-500 transition hover:text-slate-200" aria-label={`More options for ${title}`}>•••</button>
      </div>
      {children}
    </section>
  );
}
