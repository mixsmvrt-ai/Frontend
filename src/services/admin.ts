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

export type AdminSupportMessage = { id: string; body: string; author_id: string; created_at: string };
export type AdminSupportTicket = { id: string; subject: string; status: "open" | "pending" | "resolved"; priority: string; assigned_to: string | null; created_at: string; updated_at: string; admin_read_at: string | null; unread: boolean; sender: { id: string; name: string; email: string | null }; support_messages: AdminSupportMessage[] };

export async function getAdminSupportTickets() {
  return apiRequest<{ data: AdminSupportTicket[] }>("/admin/support/tickets");
}

export async function getAdminSupportUnreadCount() {
  return apiRequest<{ data: { unread: number } }>("/admin/support/unread-count");
}

export async function getAdminSupportTicket(ticketId: string) {
  return apiRequest<{ data: AdminSupportTicket }>(`/admin/support/tickets/${encodeURIComponent(ticketId)}`);
}

export async function updateAdminSupportTicket(ticketId: string, input: { status?: AdminSupportTicket["status"]; assignedTo?: string | null }) {
  return apiRequest<{ data: AdminSupportTicket }>(`/admin/support/tickets/${encodeURIComponent(ticketId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function replyToAdminSupportTicket(ticketId: string, body: string) {
  return apiRequest<{ data: AdminSupportMessage }>(`/admin/support/tickets/${encodeURIComponent(ticketId)}/messages`, { method: "POST", body: JSON.stringify({ body }) });
}
