"use client";

import Link from "next/link";
import { CalendarDays, Check, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { PayPalCheckout } from "@/features/billing/paypal-checkout";
import { useMembership } from "@/features/billing/use-membership";

export default function UpgradePage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership, error, loading } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl">
        <header className="grid gap-6 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,.22),_transparent_42%),linear-gradient(145deg,_rgba(15,14,29,.96),_rgba(9,8,22,.98))] p-8 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Upgrade</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Restore full creation access with a 30-day Pro Pass.</h1>
            <p className="mt-4 max-w-2xl text-[#b9b4c9]">Every account starts with a 7-day full Pro trial. When that trial ends, your studio stays available in read-only mode until you purchase a one-time Pro Pass.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#d9d4e8]">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">7-day full trial on signup</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">One-time PayPal checkout</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">30 days of active creation</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <div className="flex items-center gap-3">
              <Lock className="size-5 text-violet-300" />
              <p className="text-sm font-semibold text-white">Current studio status</p>
            </div>
            {error ? <p className="mt-5 text-sm text-red-200">{error}</p> : loading && isAuthenticated ? <div className="mt-5 h-32 animate-pulse rounded-xl bg-white/5" /> : !isAuthenticated ? <><p className="mt-5 text-3xl font-bold capitalize">Guest</p><p className="mt-2 text-sm text-[#b9b4c9]">Browse the upgrade flow now. You will only need to sign in when you start checkout.</p><div className="mt-5 rounded-xl bg-white/5 p-4"><CalendarDays className="size-4 text-violet-300" /><p className="mt-3 text-sm text-[#e4dfef]">A 30-day Pro Pass restores full creation access with a one-time payment.</p></div></> : !membership ? <div className="mt-5 h-32 animate-pulse rounded-xl bg-white/5" /> : <><p className="mt-5 text-3xl font-bold capitalize">{membership.type === "expired" ? "Read-only" : membership.type}</p><p className="mt-2 text-sm text-[#b9b4c9]">{membership.type === "trial" ? `${membership.daysRemaining} days left in your trial.` : membership.type === "pro" ? `${membership.daysRemaining} days left in your current Pro Pass.` : membership.type === "admin" ? "Administrative access is active." : "Generation, new projects, uploads, and write actions are paused until you upgrade."}</p><div className="mt-5 rounded-xl bg-white/5 p-4"><CalendarDays className="size-4 text-violet-300" /><p className="mt-3 text-sm text-[#e4dfef]">{membership.accessExpiresAt ? `Paid access expires ${new Date(membership.accessExpiresAt).toLocaleDateString()}` : membership.trialExpiresAt ? `Trial ended or expires ${new Date(membership.trialExpiresAt).toLocaleDateString()}` : "Your account is ready for a Pro Pass."}</p></div></>}
          </div>
        </header>
        <div className="mt-8 grid gap-6 lg:grid-cols-[.95fr_1.05fr]">
          <section className="glass rounded-2xl p-6">
            <p className="text-sm font-semibold text-violet-200">What unlocks immediately</p>
            <ul className="mt-6 space-y-4 text-sm text-[#ddd7eb]">
              <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-violet-300" />Unlimited MIDI generation and retry flows for the next 30 days.</li>
              <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-violet-300" />Project creation, duplication, notes, uploads, and archive actions become writable again.</li>
              <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-violet-300" />Voice-to-MIDI, AI orchestration, and export workflows stay available for the full paid term.</li>
              <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-violet-300" />Existing projects, receipts, downloads, and billing history remain available even while expired.</li>
            </ul>
            <Link href="/billing" className="mt-8 inline-block text-sm font-semibold text-violet-300">Review billing history</Link>
          </section>
          <section className="rounded-2xl border border-violet-400/50 bg-violet-500/10 p-6">
            <p className="text-sm text-violet-200">30-day Pro Pass</p>
            <h2 className="mt-3 text-4xl font-black">{membership?.price ? new Intl.NumberFormat(undefined, { style: "currency", currency: membership.price.currency }).format(membership.price.amountCents / 100) : "Configured in backend"}</h2>
            <p className="mt-2 text-sm text-[#d9d4e8]">One payment activates {membership?.price?.days ?? 30} days of full access. No subscription. No auto-renewal.</p>
            <div className="mt-8">
              <PayPalCheckout mode="upgrade" />
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
