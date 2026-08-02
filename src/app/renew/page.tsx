"use client";

import { CalendarDays, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { PayPalCheckout } from "@/features/billing/paypal-checkout";
import { useMembership } from "@/features/billing/use-membership";

export default function RenewPage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership, error, loading } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Membership</p>
        <h1 className="mt-2 text-4xl font-black">Keep your creative flow open.</h1>
        {error ? <p className="mt-8 text-red-200">{error}</p> : null}
        {loading && isAuthenticated ? (
          <div className="mt-8 h-72 animate-pulse rounded-2xl bg-white/5" />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.85fr]">
            <section className="glass rounded-2xl p-6">
              <p className="text-sm text-[#aaa3bd]">Current access</p>
              <h2 className="mt-1 text-2xl font-bold capitalize">{isAuthenticated ? membership?.type ?? "membership" : "guest"}</h2>
              <div className="mt-7 rounded-xl bg-white/5 p-4">
                <CalendarDays className="size-5 text-violet-300" />
                <p className="mt-4 font-semibold">
                  {!isAuthenticated
                    ? "Sign in when you want to renew or activate access"
                    : membership?.type === "pro" || membership?.type === "trial"
                    ? `${membership.daysRemaining} days remaining`
                    : membership?.type === "admin"
                      ? "Admin access active"
                      : "Read-only mode active"}
                </p>
                <p className="mt-1 text-sm text-[#aaa3bd]">
                  {!isAuthenticated
                    ? "The renew page stays visible to guests, but payment starts only after login."
                    : membership?.accessExpiresAt
                    ? `Paid access expires ${new Date(membership.accessExpiresAt).toLocaleDateString()}`
                    : membership?.trialExpiresAt
                      ? `Trial expires ${new Date(membership.trialExpiresAt).toLocaleDateString()}`
                      : "Renew your 30-day Pro Pass to keep creating without interruption."}
                </p>
              </div>
            </section>
            <section className="rounded-2xl border border-violet-400/50 bg-violet-500/10 p-6">
              <p className="text-sm text-violet-200">30-day Pro Pass</p>
              <h2 className="mt-3 text-3xl font-bold">
                {membership?.price
                  ? new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: membership.price.currency,
                    }).format(membership.price.amountCents / 100)
                  : "Configured in backend"}
              </h2>
              <ul className="mt-6 space-y-3 text-sm text-[#ded9ed]">
                <li className="flex items-center gap-3"><Check className="size-4 text-violet-200" />Unlimited MIDI generation during your active term</li>
                <li className="flex items-center gap-3"><Check className="size-4 text-violet-200" />Voice to MIDI and orchestration tools</li>
                <li className="flex items-center gap-3"><Check className="size-4 text-violet-200" />Cloud project history, notes, and exports</li>
                <li className="flex items-center gap-3"><Check className="size-4 text-violet-200" />Secure one-time PayPal checkout</li>
              </ul>
              <div className="mt-8">
                <PayPalCheckout mode="renew" />
              </div>
            </section>
          </div>
        )}
      </section>
    </AppShell>
  );
}
