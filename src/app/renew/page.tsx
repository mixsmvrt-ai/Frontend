"use client";

import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { PayPalCheckout } from "@/features/billing/paypal-checkout";
import { useMembership } from "@/features/billing/use-membership";

export default function RenewPage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership, error, loading } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl pb-10">
        <Link href="/billing" className="inline-flex items-center gap-2 text-sm text-[#aaa3bd] transition hover:text-white"><ArrowLeft className="size-4" />Back to billing</Link>
        <h1 className="mt-7 text-3xl font-black">Checkout</h1>
        {error ? <p className="mt-8 text-red-200">{error}</p> : null}
        {loading && isAuthenticated ? (
          <div className="mt-8 h-72 animate-pulse rounded-2xl bg-white/5" />
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-xl border border-white/10 bg-[#111424] p-5 text-white shadow-[0_20px_70px_rgba(0,0,0,.25)] sm:p-7"><div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a8a0bb]">Order summary</p><h2 className="mt-2 text-xl font-bold">MidiFlow Pro Pass</h2></div><Lock className="size-5 text-[#aaa3bd]" /></div><div className="mt-5 flex items-center justify-between rounded-lg border border-white/10 bg-white/[.04] p-4"><div><p className="font-semibold">Renewal</p><p className="mt-1 text-sm text-[#aaa3bd]">Full creation access for 30 days</p></div><p className="text-lg font-bold">{membership?.price ? new Intl.NumberFormat(undefined, { style: "currency", currency: membership.price.currency }).format(membership.price.amountCents / 100) : "Configured in backend"}</p></div><div className="mt-6 flex items-center gap-2 text-sm text-[#aaa3bd]"><ShieldCheck className="size-4 text-emerald-400" />Secure checkout. No subscription or auto-renewal.</div></section><section className="rounded-xl border border-white/10 bg-[#111424] p-5 shadow-[0_20px_70px_rgba(0,0,0,.25)] sm:p-7"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a8a0bb]">Pricing details</p><div className="mt-5 flex justify-between border-b border-white/10 pb-4 text-base font-bold text-white"><span>Total</span><span>{membership?.price ? new Intl.NumberFormat(undefined, { style: "currency", currency: membership.price.currency }).format(membership.price.amountCents / 100) : "Configured in backend"}</span></div><div className="mt-6"><PayPalCheckout mode="renew" /></div></section></div>
        )}
      </section>
    </AppShell>
  );
}
