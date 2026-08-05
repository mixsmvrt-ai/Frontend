"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Copy, DollarSign, Loader2, Mail, QrCode, Send, Share2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { referralApi, type ReferralDashboard } from "@/services/referrals";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

const statsOrder: Array<[keyof ReferralDashboard["stats"], string]> = [
  ["totalReferrals", "Total Referrals"],
  ["successfulReferrals", "Successful Referrals"],
  ["pendingReferrals", "Pending Referrals"],
  ["trialReferrals", "Trial Referrals"],
  ["paidReferrals", "Paid Referrals"],
  ["totalEarnings", "Total Earnings"],
  ["availableBalance", "Available Balance"],
  ["pendingBalance", "Pending Balance"],
  ["lifetimeCommission", "Lifetime Commission"],
  ["payoutsReceived", "Payouts Received"],
  ["nextPayoutEligibility", "Next Payout Eligibility"],
];

export default function ReferralsPage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!authResolved) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const { data } = await referralApi.dashboard();
        setDashboard(data);
        setPaypalEmail(data.wallet.payoutEmail ?? "");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load referral program.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [authResolved, isAuthenticated]);

  const qrSrc = useMemo(() => dashboard ? `https://quickchart.io/qr?size=220&text=${encodeURIComponent(dashboard.link)}` : "", [dashboard]);

  async function copyText(kind: "link" | "code") {
    if (!dashboard) return;
    try {
      await navigator.clipboard.writeText(kind === "link" ? dashboard.link : dashboard.code);
      await referralApi.copy();
      toast.success(kind === "link" ? "Referral link copied." : "Referral code copied.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to copy referral details.");
    }
  }

  async function shareReferral() {
    if (!dashboard) return;
    try {
      const canShare = typeof navigator.share === "function";
      if (canShare) {
        await navigator.share({ title: "MidiFlow referral", text: "Join me on MidiFlow and start creating.", url: dashboard.link });
      } else {
        await navigator.clipboard.writeText(dashboard.link);
      }
      await referralApi.share({ channel: canShare ? "native" : "clipboard" });
      toast.success("Referral link shared.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to share referral link.");
    }
  }

  async function requestPayout() {
    if (!isAuthenticated) {
      promptSignIn("/referrals");
      return;
    }
    setSaving(true);
    try {
      await referralApi.requestPayout({ amount: amount.trim() ? Number(amount) : undefined, paypalEmail: paypalEmail.trim() || undefined });
      const { data } = await referralApi.dashboard();
      setDashboard(data);
      setPaypalEmail(data.wallet.payoutEmail ?? "");
      setAmount("");
      toast.success("Payout request submitted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request payout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Referral Program</p>
            <h1 className="mt-2 text-4xl font-black">Invite other producers to MidiFlow and earn commission when they purchase a plan.</h1>
          </div>
        </header>

        {loading ? <div className="glass mt-8 flex items-center gap-3 rounded-2xl p-6 text-[#c8c2d6]"><Loader2 className="size-4 animate-spin" />Loading referrals…</div> : null}

        {!loading && !isAuthenticated ? <div className="glass mt-8 rounded-2xl p-6 text-sm text-[#c8c2d6]">Sign in to access your referral dashboard and wallet.</div> : null}

        {!loading && isAuthenticated && dashboard ? (
          <div className="mt-8 space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
              <article className="glass rounded-3xl p-6">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Referral Link</p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                    <p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Referral Code</p>
                    <p className="mt-2 font-mono text-2xl font-bold tracking-[.18em] text-white">{dashboard.code}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                    <p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Referral Link</p>
                    <p className="mt-2 break-all text-sm text-[#d8d2e3]">{dashboard.link}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => void copyText("link")} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold"><Copy className="mr-2 inline size-4" />Copy Link</button>
                    <button type="button" onClick={() => void copyText("code")} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white"><Copy className="mr-2 inline size-4" />Copy Code</button>
                    <button type="button" onClick={() => void shareReferral()} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white"><Share2 className="mr-2 inline size-4" />Share</button>
                    <button type="button" onClick={() => setShowQr((value) => !value)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white"><QrCode className="mr-2 inline size-4" />Generate QR Code</button>
                  </div>
                </div>
              </article>

              <article className="glass rounded-3xl p-6">
                <div className="flex items-center gap-3 text-violet-200"><Wallet className="size-5" /><h2 className="text-xl font-bold text-white">Referral Wallet</h2></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Available Balance</p><p className="mt-2 text-2xl font-bold">{money(dashboard.wallet.availableBalance)}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Pending Balance</p><p className="mt-2 text-2xl font-bold">{money(dashboard.wallet.pendingBalance)}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Lifetime Earnings</p><p className="mt-2 text-2xl font-bold">{money(dashboard.wallet.lifetimeEarnings)}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Minimum Payout</p><p className="mt-2 text-2xl font-bold">{money(dashboard.wallet.minimumPayout)}</p></div>
                </div>
                <div className="mt-5 grid gap-4">
                  <label className="block text-sm font-medium">PayPal Email<input value={paypalEmail} onChange={(event) => setPaypalEmail(event.target.value)} className="field mt-2" placeholder="paypal@email.com" /></label>
                  <label className="block text-sm font-medium">Request Amount (USD)<input value={amount} onChange={(event) => setAmount(event.target.value)} className="field mt-2" placeholder={dashboard.wallet.requestableBalance.toFixed(2)} /></label>
                  <div className="grid gap-2 text-sm text-[#aaa3bd]">
                    <p>Last payout: {dashboard.wallet.lastPayout ? new Date(dashboard.wallet.lastPayout).toLocaleDateString() : "No payouts yet"}</p>
                    <p>Outstanding requested: {money(dashboard.summary.outstandingRequested)}</p>
                  </div>
                  <button type="button" onClick={() => void requestPayout()} disabled={saving} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-60"><Send className="mr-2 inline size-4" />{saving ? "Submitting..." : "Request payout"}</button>
                </div>
              </article>
            </section>

            {showQr ? (
              <section className="glass rounded-3xl p-6">
                <div className="flex items-center gap-3"><QrCode className="size-5 text-violet-300" /><h2 className="text-xl font-bold">Share QR Code</h2></div>
                <div className="mt-5 flex flex-col items-start gap-4 md:flex-row md:items-center">
                  <Image src={qrSrc} alt="Referral QR code" width={220} height={220} unoptimized className="rounded-2xl border border-white/10 bg-white p-3" />
                  <p className="max-w-xl text-sm text-[#cfc8de]">Use this QR code on flyers, beat packs, and social posts so producers can open your referral link directly on mobile.</p>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statsOrder.map(([key, label]) => (
                <article key={String(key)} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <p className="text-sm text-[#aaa3bd]">{label}</p>
                  <p className="mt-3 text-3xl font-bold">
                    {typeof dashboard.stats[key] === "number"
                      ? ["totalEarnings", "availableBalance", "pendingBalance", "lifetimeCommission", "payoutsReceived"].includes(String(key))
                        ? money(Number(dashboard.stats[key]))
                        : Number(dashboard.stats[key]).toLocaleString()
                      : dashboard.stats[key] ? new Date(String(dashboard.stats[key])).toLocaleDateString() : "Pending"}
                  </p>
                </article>
              ))}
            </section>

            <section className="glass rounded-3xl p-6">
              <h2 className="text-xl font-bold">Referral Activity</h2>
              <div className="data-scroll data-scroll-x mt-5 rounded-2xl border border-white/10">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-white/[.03] text-[#aaa3bd]"><tr><th className="p-4">Referral Name</th><th className="p-4">Signup Date</th><th className="p-4">Plan Purchased</th><th className="p-4">Purchase Amount</th><th className="p-4">Commission Earned</th><th className="p-4">Status</th></tr></thead>
                  <tbody>
                    {dashboard.activity.map((item) => (
                      <tr key={item.id} className="border-t border-white/10"><td className="p-4">{item.referralName}</td><td className="p-4">{new Date(item.signupDate).toLocaleDateString()}</td><td className="p-4">{item.planPurchased}</td><td className="p-4">{money(item.purchaseAmount)}</td><td className="p-4">{money(item.commissionEarned)}</td><td className="p-4">{item.status}</td></tr>
                    ))}
                  </tbody>
                </table>
                {!dashboard.activity.length ? <p className="p-6 text-sm text-[#aaa3bd]">No referral activity has been recorded yet.</p> : null}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <article className="glass rounded-3xl p-6">
                <div className="flex items-center gap-3"><DollarSign className="size-5 text-violet-300" /><h2 className="text-xl font-bold">Payout Requests</h2></div>
                <div className="mt-5 space-y-3">
                  {dashboard.payouts.map((row, index) => (
                    <div key={String(row.id ?? index)} className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-[#d6d0e2]">
                      <p className="font-semibold text-white">{money(Number(row.amount_cents ?? 0) / 100)}</p>
                      <p className="mt-1">{String(row.status ?? "pending")}</p>
                      <p className="mt-1 text-xs text-[#9b94af]">{row.requested_at ? new Date(String(row.requested_at)).toLocaleString() : "Pending"}</p>
                    </div>
                  ))}
                  {!dashboard.payouts.length ? <p className="text-sm text-[#aaa3bd]">No payout requests yet.</p> : null}
                </div>
              </article>

              <article className="glass rounded-3xl p-6">
                <div className="flex items-center gap-3"><Mail className="size-5 text-violet-300" /><h2 className="text-xl font-bold">Payout History</h2></div>
                <div className="mt-5 space-y-3">
                  {dashboard.payoutHistory.map((row, index) => (
                    <div key={String(row.id ?? index)} className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-[#d6d0e2]">
                      <p className="font-semibold text-white">{money(Number(row.amount_cents ?? 0) / 100)}</p>
                      <p className="mt-1">{String(row.paypal_email ?? "")}</p>
                      <p className="mt-1 text-xs text-[#9b94af]">Transaction ID: {String(row.paypal_transaction_id ?? row.paypal_payout_id ?? "Pending")}</p>
                    </div>
                  ))}
                  {!dashboard.payoutHistory.length ? <p className="text-sm text-[#aaa3bd]">No completed payouts yet.</p> : null}
                </div>
              </article>
            </section>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}