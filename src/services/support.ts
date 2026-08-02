import { apiRequest } from "@/services/api";

export interface SupportMessage {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  support_messages?: SupportMessage[];
}

export const supportApi = {
  list: () => apiRequest<{ data: SupportTicket[] }>("/account/support/tickets"),
  create: (input: { subject: string; message: string; priority: "low" | "normal" | "high" | "urgent" }) =>
    apiRequest<{ data: SupportTicket }>("/account/support/tickets", { method: "POST", body: JSON.stringify(input) }),
  reply: (ticketId: string, body: string) =>
    apiRequest<{ data: SupportMessage }>(`/account/support/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
};
