"use client";

import Link from "next/link";
import { Bell, BookOpen, Check, HelpCircle, LogOut, Shield, Sparkles, Settings, UserRound, Volume2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MembershipSnapshot } from "@/services/api";

type SettingsSheetProps = {
  isAuthenticated: boolean;
  membership: MembershipSnapshot | null;
  showAdminLink: boolean;
  onSubscription: () => void;
  onNavigate: () => void;
};

function SheetLink({ label, href, icon: Icon, onNavigate }: { label: string; href: string; icon: LucideIcon; onNavigate: () => void }) {
  return <Link href={href} onClick={onNavigate} className="flex items-center gap-4 border-b border-white/[.1] px-4 py-4 text-[15px] font-semibold text-[#f2f2f4] transition last:border-0 hover:bg-white/[.06]">
    <Icon className="size-5 shrink-0 text-[#f5f5f7]" />
    <span className="min-w-0 flex-1">{label}</span>
    <span className="text-2xl leading-none text-[#6f7078]">›</span>
  </Link>;
}

export function SettingsSheet({ isAuthenticated, membership, showAdminLink, onSubscription, onNavigate }: SettingsSheetProps) {
  const accountStatus = !isAuthenticated
    ? "Sign in to sync your workspace"
    : membership?.type === "trial"
      ? `${membership.daysRemaining} trial days remaining`
      : membership?.type === "pro"
        ? `${membership.daysRemaining} days of ${membership.plan === "go" ? "Go" : "Plus"} remaining`
        : membership?.type === "expired" ? "Read-only access" : "Administrator access";

  return <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[34px] border border-white/[.08] bg-[#1c1c1e] px-4 py-5 text-white shadow-[0_28px_100px_rgba(0,0,0,.65)]">
    <div className="flex items-center justify-between px-3 pb-5">
      <div><p className="text-xl font-bold">Settings</p><p className="mt-1 text-xs text-[#9b9ba2]">Your MidiFlow workspace</p></div>
      <button type="button" onClick={onNavigate} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.04] text-2xl text-white" aria-label="Close settings"><X className="size-5" /></button>
    </div>

    <div className="overflow-hidden rounded-[28px] bg-[#2b2b2d]">
      <Link href={isAuthenticated ? "/profile" : "/login?next=%2Fcreate"} onClick={onNavigate} className="flex items-center gap-4 border-b border-white/[.1] px-4 py-5">
        <span className="grid size-12 place-items-center rounded-full bg-violet-500 text-lg font-bold">{isAuthenticated ? "MF" : <UserRound className="size-5" />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-base font-bold">{isAuthenticated ? "My account" : "Sign in"}</span><span className="mt-1 block truncate text-xs text-[#a9a9b0]">{accountStatus}</span></span><span className="text-2xl text-[#77777e]">›</span>
      </Link>
      <button type="button" onClick={onSubscription} className="flex w-full items-center gap-4 border-b border-white/[.1] px-4 py-4 text-left transition hover:bg-white/[.06]"><Sparkles className="size-5 text-sky-300" /><span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Subscription</span><span className="mt-1 block text-xs text-[#a9a9b0]">{membership?.type === "pro" ? `${membership.plan === "go" ? "Go" : "Plus"} active` : "Choose a plan"}</span></span><span className="text-2xl text-[#77777e]">›</span></button>
    </div>

    <p className="px-3 pb-2 pt-7 text-lg font-bold text-[#a9a9ad]">Customize MidiFlow</p>
    <div className="overflow-hidden rounded-[28px] bg-[#2b2b2d]">
      <SheetLink label="General" href="/settings" icon={Settings} onNavigate={onNavigate} />
      <SheetLink label="Notifications" href="/settings" icon={Bell} onNavigate={onNavigate} />
      <SheetLink label="Voice to MIDI" href="/voice-to-midi" icon={Volume2} onNavigate={onNavigate} />
      <SheetLink label="Parental controls" href="/profile" icon={UserRound} onNavigate={onNavigate} />
      <SheetLink label="Safety" href="/support" icon={Shield} onNavigate={onNavigate} />
      <SheetLink label="Security and login" href="/profile" icon={Shield} onNavigate={onNavigate} />
      <SheetLink label="Storage" href="/downloads" icon={BookOpen} onNavigate={onNavigate} />
      <SheetLink label="Data controls" href="/settings" icon={UserRound} onNavigate={onNavigate} />
      <SheetLink label="Ads controls" href="/settings" icon={Sparkles} onNavigate={onNavigate} />
      {showAdminLink ? <SheetLink label="Admin operations" href="/admin" icon={Shield} onNavigate={onNavigate} /> : null}
    </div>

    <p className="px-3 pb-2 pt-7 text-lg font-bold text-[#a9a9ad]">Get help</p>
    <div className="overflow-hidden rounded-[28px] bg-[#2b2b2d]">
      <SheetLink label="Support center" href="/support" icon={HelpCircle} onNavigate={onNavigate} />
      <SheetLink label="Pricing and plans" href="/pricing" icon={Sparkles} onNavigate={onNavigate} />
    </div>

    {isAuthenticated ? <Link href="/logout" onClick={onNavigate} className="mt-7 flex items-center gap-4 rounded-[28px] bg-[#2b2b2d] px-4 py-5 text-[15px] font-semibold text-red-400"><LogOut className="size-5" />Log out</Link> : null}
  </div>;
}

export function SubscriptionDialog({ membership, onClose }: { membership: MembershipSnapshot | null; onClose: () => void }) {
  const prices = membership?.prices;
  const planCards = [
    { id: "go" as const, name: "Go", detail: "Text-to-MIDI essentials", fallback: "$5.99", features: ["Text to MIDI generation", "Projects and MIDI downloads", "Basic support"] },
    { id: "plus" as const, name: "Plus", detail: "The complete MidiFlow studio", fallback: "$19.99", features: ["Everything in Go", "Voice to MIDI and Song Pack Generator", "Fast support"] },
  ];

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Subscription plans">
    <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#111113] p-6 shadow-[0_30px_100px_rgba(0,0,0,.7)] sm:p-8">
      <button type="button" onClick={onClose} className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-white/10 text-white" aria-label="Close subscription dialog"><X className="size-5" /></button>
      <div className="pr-12"><p className="text-sm font-bold uppercase tracking-[.16em] text-sky-300">Subscription</p><h2 className="mt-3 text-3xl font-black">Choose your creative pace.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#aaaab1]">Plans use the secure checkout already configured for your MidiFlow account.</p></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {planCards.map((plan) => { const price = prices?.[plan.id]; return <article key={plan.id} className={`rounded-[24px] border p-5 ${plan.id === "plus" ? "border-violet-400/70 bg-violet-500/10" : "border-white/10 bg-white/[.04]"}`}>
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{plan.name}</h3><p className="mt-1 text-sm text-[#aaaab1]">{plan.detail}</p></div>{plan.id === "plus" ? <span className="rounded-full bg-violet-500 px-2.5 py-1 text-[10px] font-bold uppercase">Popular</span> : null}</div>
          <p className="mt-6 text-4xl font-black">{price ? new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(price.amountCents / 100) : plan.fallback}<span className="ml-1 text-xs font-normal text-[#9999a1]">/ {price?.days ?? 30} days</span></p>
          <Link href={`/upgrade?plan=${plan.id}`} onClick={onClose} className={`mt-6 block rounded-xl px-4 py-3 text-center text-sm font-bold ${plan.id === "plus" ? "bg-violet-500 text-white" : "bg-white/10 hover:bg-white/15"}`}>{membership?.plan === plan.id ? "Current plan" : `Choose ${plan.name}`}</Link>
          <ul className="mt-6 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-[#d8d8dd]"><Check className="size-4 shrink-0 text-sky-300" />{feature}</li>)}</ul>
        </article>; })}
      </div>
    </div>
  </div>;
}
