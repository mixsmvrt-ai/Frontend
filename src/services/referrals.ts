import { apiRequest } from "@/services/api";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const referralCodeKey = "midiflow.referral.code";
const visitorIdKey = "midiflow.referral.visitor";
const clickCacheKey = "midiflow.referral.clicked";
const referralCookieKey = "midiflow_referral_code";

export type ReferralSettings = {
  enabled: boolean;
  defaultCommissionType: "percentage" | "flat";
  defaultCommissionRate: number;
  flatCommissionCents: number;
  minimumPayoutCents: number;
  eligibilityDelayDays: number;
  cookieDurationDays: number;
  referralExpirationDays: number;
  allowSelfReferrals: boolean;
  allowMultipleReferrals: boolean;
  maximumCommissionPerUserCents: number;
  maximumPayoutPerMonthCents: number;
  automaticApproval: boolean;
  manualApproval: boolean;
};

export type ReferralDashboard = {
  code: string;
  link: string;
  settings: ReferralSettings;
  wallet: {
    availableBalance: number;
    pendingBalance: number;
    lifetimeEarnings: number;
    minimumPayout: number;
    payoutEmail: string | null;
    lastPayout: string | null;
    requestableBalance: number;
  };
  stats: {
    totalReferrals: number;
    successfulReferrals: number;
    pendingReferrals: number;
    trialReferrals: number;
    paidReferrals: number;
    totalEarnings: number;
    availableBalance: number;
    pendingBalance: number;
    lifetimeCommission: number;
    payoutsReceived: number;
    nextPayoutEligibility: string | null;
    totalClicks: number;
    eligibleCommissions: number;
  };
  activity: Array<{
    id: string;
    referralName: string;
    signupDate: string;
    planPurchased: string;
    purchaseAmount: number;
    commissionEarned: number;
    status: string;
  }>;
  payouts: Array<Record<string, unknown>>;
  payoutHistory: Array<Record<string, unknown>>;
  summary: {
    latestPayoutAt: string | null;
    outstandingRequested: number;
  };
};

type StoredReferral = {
  code: string;
  capturedAt: string;
  visitorId: string;
  signupSource: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readCookie(name: string) {
  if (!isBrowser()) return "";
  const value = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.split("=")[1] ?? "") : "";
}

function writeCookie(name: string, value: string, maxAgeDays: number) {
  if (!isBrowser()) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeDays * 86400}; Path=/; SameSite=Lax`;
}

function visitorId() {
  if (!isBrowser()) return "server";
  const existing = window.localStorage.getItem(visitorIdKey);
  if (existing) return existing;
  const created = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(visitorIdKey, created);
  return created;
}

export function getStoredReferral() {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(referralCodeKey);
  if (raw) {
    try {
      return JSON.parse(raw) as StoredReferral;
    } catch {
      window.localStorage.removeItem(referralCodeKey);
    }
  }
  const cookieCode = readCookie(referralCookieKey);
  if (!cookieCode) return null;
  const restored = { code: cookieCode, capturedAt: new Date().toISOString(), visitorId: visitorId(), signupSource: "referral_link" } satisfies StoredReferral;
  window.localStorage.setItem(referralCodeKey, JSON.stringify(restored));
  return restored;
}

export function persistReferralCode(code: string, signupSource = "referral_link") {
  if (!isBrowser()) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const stored = { code: normalized, capturedAt: new Date().toISOString(), visitorId: visitorId(), signupSource } satisfies StoredReferral;
  window.localStorage.setItem(referralCodeKey, JSON.stringify(stored));
  writeCookie(referralCookieKey, normalized, 45);
  return stored;
}

export function signupReferralMetadata() {
  const stored = getStoredReferral();
  if (!stored) return {};
  return {
    referral_code: stored.code,
    referral_device_fingerprint: stored.visitorId,
    referral_session_id: stored.visitorId,
    referral_source: stored.signupSource,
  };
}

export async function captureReferralFromUrl(search: string, pathname: string) {
  if (!isBrowser()) return null;
  const params = new URLSearchParams(search);
  const ref = params.get("ref")?.trim().toUpperCase();
  if (!ref) return getStoredReferral()?.code ?? null;
  const stored = persistReferralCode(ref);
  const clickCache = `${ref}:${pathname}`;
  if (window.sessionStorage.getItem(clickCacheKey) === clickCache) return stored?.code ?? ref;
  window.sessionStorage.setItem(clickCacheKey, clickCache);
  try {
    await fetch(`${apiBase}/referrals/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: ref, visitorSessionId: stored?.visitorId, landingPath: pathname, deviceFingerprint: stored?.visitorId, signupSource: stored?.signupSource ?? "referral_link" }),
    });
  } catch {
    return stored?.code ?? ref;
  }
  return stored?.code ?? ref;
}

export const referralApi = {
  dashboard() {
    return apiRequest<{ data: ReferralDashboard }>("/referrals");
  },
  stats() {
    return apiRequest<{ data: ReferralDashboard["stats"] & { code: string; link: string } }>("/referrals/stats");
  },
  activity() {
    return apiRequest<{ data: { activity: ReferralDashboard["activity"]; code: string; link: string } }>("/referrals/activity");
  },
  copy() {
    return apiRequest<{ data: { ok: boolean } }>("/referrals/copy", { method: "POST", body: JSON.stringify({}) });
  },
  share(payload: { channel?: string; target?: string }) {
    return apiRequest<{ data: { ok: boolean } }>("/referrals/share", { method: "POST", body: JSON.stringify(payload) });
  },
  requestPayout(payload: { amount?: number; paypalEmail?: string }) {
    return apiRequest<{ data: Record<string, unknown> }>("/referrals/payout-request", { method: "POST", body: JSON.stringify(payload) });
  },
};