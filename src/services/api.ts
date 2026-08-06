import { supabase } from "@/lib/supabase/browser";

export interface PlanPrice {
  amountCents: number;
  currency: string;
  days: number;
}

export interface CreditSummary {
  monthlyAllocation: number;
  balance: number;
  used: number;
  usagePercent: number;
  textBalance: number;
  textUsed: number;
  textUsagePercent: number;
  resetsOn: string;
  textToMidiCost: number;
  voiceToMidiCost: number;
  textToMidiGenerationLimit: number;
  textToMidiGenerationsRemaining: number;
}

export interface MembershipSnapshot {
  type: "trial" | "pro" | "expired" | "admin";
  status: "trial_active" | "pro_active" | "expired" | "admin";
  active: boolean;
  readOnly: boolean;
  isAdmin: boolean;
  canGenerate: boolean;
  canCreateProjects: boolean;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  proStartedAt: string | null;
  accessExpiresAt: string | null;
  lastPaymentAt: string | null;
  totalPayments: number;
  daysRemaining: number;
  trialDaysRemaining: number;
  price?: PlanPrice;
  credits?: CreditSummary;
}

export class MembershipExpiredError extends Error {
  redirectTo: string;
  membership?: MembershipSnapshot;

  constructor(message: string, redirectTo = "/upgrade", membership?: MembershipSnapshot) {
    super(message);
    this.name = "MembershipExpiredError";
    this.redirectTo = redirectTo;
    this.membership = membership;
  }
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function authHeaders({ redirectOnMissingUser = true }: { redirectOnMissingUser?: boolean } = {}) {
  const sessionResult = await supabase?.auth.getSession();
  const session = sessionResult?.data.session;
  const user = session?.user;
  if (!user) {
    if (redirectOnMissingUser && typeof window !== "undefined") {
      const next = window.location.pathname + window.location.search;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    throw new Error("Sign in to continue.");
  }
  return {
    "Content-Type": "application/json",
    "x-user-id": user.id,
    ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

export async function apiRequest<T>(path: string, init?: RequestInit, options?: { redirectOnMissingUser?: boolean }): Promise<T> {
  const headers = await authHeaders({ redirectOnMissingUser: options?.redirectOnMissingUser ?? true });
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...headers,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    if (response.status === 403 && payload.code === "MEMBERSHIP_EXPIRED") {
      const redirectTo = typeof payload.redirectTo === "string" ? payload.redirectTo : "/upgrade";
      if (typeof window !== "undefined") {
        window.location.assign(redirectTo);
      }
      throw new MembershipExpiredError(
        typeof payload.error === "string" ? payload.error : "Membership expired.",
        redirectTo,
        payload.membership as MembershipSnapshot | undefined,
      );
    }

    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed.");
  }

  return (response.status === 204 ? undefined : payload) as T;
}