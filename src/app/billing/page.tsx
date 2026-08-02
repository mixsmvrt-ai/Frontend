"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { useMembership } from "@/features/billing/use-membership";
import { apiRequest } from "@/services/api";

interface Payment {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  paypal_order_id: string;
  created_at: string;
  access_expires_at?: string | null;
  billing_history?: Array<{ invoice_number: string }>;
}

export default function BillingPage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authResolved) return;
    if (!isAuthenticated) {
      setItems([]);
      setError("");
      return;
    }
    apiRequest<{ data: Payment[] }>("/billing")
      .then((payload) => setItems(payload.data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load billing."));
  }, [authResolved, isAuthenticated]);

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Billing</p>
          <h1 className="mt-2 text-4xl font-black">Payments and receipts.</h1>
          <p className="mt-3 text-sm text-[#aaa3bd]">
            {membership?.type === "trial"
              ? `Your full Pro trial ends ${membership.trialExpiresAt ? new Date(membership.trialExpiresAt).toLocaleDateString() : "soon"}.`
              : membership?.type === "pro"
                ? `Your Pro Pass stays active until ${membership.accessExpiresAt ? new Date(membership.accessExpiresAt).toLocaleDateString() : "your current term ends"}.`
                : membership?.type === "expired"
                  ? "Your account is read-only until you purchase a new Pro Pass."
                  : "Review your Pro Pass history and receipts."}
          </p>
        </div>
        <Link href={membership?.type === "pro" || membership?.type === "admin" ? "/renew" : "/upgrade"} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold">
          {membership?.type === "pro" || membership?.type === "admin" ? "Renew Pro Pass" : "Upgrade to Pro Pass"}
        </Link>
      </header>
      {error ? <p className="mt-8 text-red-200">{error}</p> : <div className="mt-8 space-y-5"><section className="glass rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Current access</p><h2 className="mt-3 text-2xl font-bold capitalize">{isAuthenticated ? membership?.type ?? "Membership" : "Guest"}</h2><p className="mt-2 text-sm text-[#aaa3bd]">{!isAuthenticated ? "Browse pricing and payment flows first. Sign in only when you want to purchase, review receipts, or manage access." : membership?.type === "trial" ? `${membership.daysRemaining} days remaining in your 7-day Pro trial.` : membership?.type === "pro" ? `${membership.daysRemaining} days remaining in your paid Pro Pass.` : membership?.type === "expired" ? "Read-only mode is active. Existing work remains available." : "Administrative access is active."}</p></section><div className="data-scroll data-scroll-x rounded-2xl border border-white/10">{isAuthenticated ? <table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-white/5 text-[#aaa3bd]"><tr><th className="p-4">Payment date</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4">Transaction</th><th className="p-4">Access through</th><th className="p-4">Invoice</th></tr></thead><tbody>{items.map((payment) => <tr className="border-t border-white/10" key={payment.id}><td className="p-4">{new Date(payment.created_at).toLocaleDateString()}</td><td className="p-4">{new Intl.NumberFormat(undefined, { style: "currency", currency: payment.currency }).format(payment.amount_cents / 100)}</td><td className="p-4 capitalize">{payment.status}</td><td className="p-4 font-mono text-xs text-[#aaa3bd]">{payment.paypal_order_id}</td><td className="p-4">{payment.access_expires_at ? new Date(payment.access_expires_at).toLocaleDateString() : "Pending"}</td><td className="p-4">{payment.billing_history?.[0]?.invoice_number ?? "Pending"}</td></tr>)}</tbody></table> : <p className="p-6 text-sm text-[#aaa3bd]">Payment history and invoices appear here after you sign in and complete a purchase.</p>}{isAuthenticated && !items.length ? <p className="p-6 text-sm text-[#aaa3bd]">No payments have been recorded yet.</p> : null}</div></div>}
    </AppShell>
  );
}
