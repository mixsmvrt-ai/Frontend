"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { PayPalCheckout } from "@/features/billing/paypal-checkout";
import { useMembership } from "@/features/billing/use-membership";

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") === "go" ? "go" : "plus";
  const planLabel = plan === "go" ? "Go" : "Plus";
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership, error, loading } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const price = membership?.price ? new Intl.NumberFormat(undefined, { style: "currency", currency: membership.price.currency }).format(membership.price.amountCents / 100) : "Configured in backend";
  const days = membership?.price?.days ?? 30;

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl pb-10">
        <Link href="/billing" className="inline-flex items-center gap-2 text-sm text-[#aaa3bd] transition hover:text-white"><ArrowLeft className="size-4" />Back to billing</Link>
        <h1 className="mt-7 text-3xl font-black tracking-tight text-white">Checkout</h1>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-xl border border-white/10 bg-[#f5f7fa] p-5 text-[#1d2230] shadow-[0_20px_70px_rgba(0,0,0,.25)] sm:p-7">
            <div className="flex items-center justify-between border-b border-[#dfe3ea] pb-5"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#687080]">Order summary</p><h2 className="mt-2 text-xl font-bold">MidiFlow {planLabel}</h2></div><Lock className="size-5 text-[#687080]" /></div>
            <div className="mt-5 flex items-center justify-between rounded-lg border border-[#dfe3ea] bg-white p-4"><div><p className="font-semibold">{planLabel} Pro Pass</p><p className="mt-1 text-sm text-[#687080]">Full creation access for {days} days</p></div><p className="text-lg font-bold">{price}</p></div>
            <div className="mt-6 flex items-center gap-2 text-sm text-[#4d5666]"><ShieldCheck className="size-4 text-emerald-600" />Secure checkout. No subscription or auto-renewal.</div>
          </section>
          <section className="rounded-xl border border-white/10 bg-[#111424] p-5 shadow-[0_20px_70px_rgba(0,0,0,.25)] sm:p-7"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#a8a0bb]">Pricing details</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-[#bbb5c8]"><span>{planLabel} Pro Pass</span><span>{price}</span></div><div className="flex justify-between text-[#bbb5c8]"><span>Access</span><span>{days} days</span></div><div className="border-t border-white/10 pt-4 text-base font-bold text-white"><div className="flex justify-between"><span>Total</span><span>{price}</span></div></div></div><div className="mt-6"><PayPalCheckout mode="upgrade" plan={plan} /></div>{error ? <p className="mt-4 text-sm text-red-200">{error}</p> : loading && isAuthenticated ? <p className="mt-4 text-xs text-[#aaa3bd]">Loading your checkout details...</p> : null}</section>
        </div>
      </section>
    </AppShell>
  );
}
