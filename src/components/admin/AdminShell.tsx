"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Sparkles, Users, CreditCard, UsersRound, FolderKanban, Music2, Bot, Brain, LifeBuoy, BarChart3, X } from "lucide-react";
import { getAdminSupportUnreadCount } from "@/services/admin";

const nav = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Referrals", href: "/admin/referrals", icon: UsersRound },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "MIDI Library", href: "/admin/midi-library", icon: Music2 },
  { label: "AI Generation", href: "/admin/ai-generation", icon: Bot },
  { label: "Music Brain", href: "/admin/music-brain", icon: Brain },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const titles: Record<string, string> = {
  admin: "Dashboard", users: "Users", subscriptions: "Subscriptions", payments: "Payments", referrals: "Referrals", projects: "Projects", "midi-library": "MIDI Library", "ai-generation": "AI Generation", "music-brain": "Music Brain", support: "Support", analytics: "Analytics", settings: "Settings",
};

export default function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadSupport, setUnreadSupport] = useState(0);
  const section = pathname.split("/")[2] || "admin";
  const title = titles[section] ?? "Dashboard";
  useEffect(() => { const refreshUnreadSupport = () => { void getAdminSupportUnreadCount().then((response) => setUnreadSupport(response.data.unread)).catch(() => undefined); }; refreshUnreadSupport(); const interval = window.setInterval(refreshUnreadSupport, 30000); return () => window.clearInterval(interval); }, [pathname]);

  return (
    <div data-admin-shell className="min-h-screen bg-[#0B0B0F] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r border-white/[0.07] bg-[#111118] px-3 py-5 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-3 pb-7">
          <Link href="/create" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/20"><Sparkles size={17} /></span>
            <span className="text-sm font-semibold tracking-wide text-white">Midi<span className="text-violet-400">Flow</span></span>
          </Link>
          <button className="text-slate-500 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Workspace</div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 scrollbar-hidden">
          {nav.map(({ label, href, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${active ? "bg-violet-500/12 font-medium text-violet-200 ring-1 ring-violet-400/15" : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"}`}><Icon size={17} className={active ? "text-violet-400" : "text-slate-600 group-hover:text-slate-300"} /><span>{label}</span>{label === "Support" && unreadSupport > 0 ? <span className="ml-auto min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{unreadSupport > 99 ? "99+" : unreadSupport}</span> : active && <span className="ml-auto size-1.5 rounded-full bg-violet-400" />}</Link>;
          })}
        </nav>
        <div className="mt-4 shrink-0 space-y-3">
          <div className="rounded-xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-blue-500/5 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-violet-200"><ShieldCheck size={15} /> System healthy</div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">All services are operating normally.</p>
            <div className="mt-3 h-1 rounded-full bg-white/10"><div className="h-full w-[98%] rounded-full bg-gradient-to-r from-violet-500 to-blue-400" /></div>
          </div>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"><LogOut size={17} /> Logout</button>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-white/[0.07] bg-[#0B0B0F]/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3"><button className="grid size-9 place-items-center rounded-lg border border-white/[0.08] text-slate-400 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button><div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-600">Admin workspace</p><h1 className="mt-0.5 text-lg font-semibold text-slate-100">{title}</h1></div></div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-left text-xs text-slate-500 transition hover:border-white/15 sm:flex"><Search size={15} /><span>Search anything...</span><kbd className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-600">⌘ K</kbd></button>
            <button className="relative grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-violet-400 ring-2 ring-[#0B0B0F]" /></button>
            <span className="hidden items-center gap-2 text-xs text-slate-500 md:flex"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#22c55e]" /> All systems operational</span>
            <div className="flex items-center gap-2 border-l border-white/[0.08] pl-3"><div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-blue-500 text-xs font-bold text-white">JD</div><div className="hidden sm:block"><p className="text-xs font-medium text-slate-200">Jordan Davis</p><p className="text-[10px] text-slate-600">Super admin</p></div><ChevronDown size={14} className="hidden text-slate-600 sm:block" /></div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-72px)] overflow-x-hidden px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
