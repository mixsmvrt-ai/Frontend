import { apiRequest } from "@/services/api";

export type AdminOverview = {
  totalUsers: number;
  trialUsers: number;
  proUsers: number;
  expiredUsers: number;
  revenueCents: number;
  totalGenerations: number;
  storageBytes: number;
  openTickets: number;
};

export type AdminUser = {
  id: string;
  display_name: string | null;
  membership_type: string | null;
  membership_status: string | null;
  created_at: string | null;
  user_roles?: Array<{ role: string }>;
  credits_balance?: number | null;
  last_active_at?: string | null;
};

export async function getAdminOverview() {
  return apiRequest<{ data: AdminOverview }>("/admin/overview");
}

export async function getAdminUsers(query?: string) {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
  return apiRequest<{ data: AdminUser[]; meta: { total: number } }>(`/admin/users${suffix}`);
}

export async function getAdminResource(resource: string) {
  return apiRequest<{ data: Array<Record<string, unknown>> }>(`/admin/${resource}`);
}
