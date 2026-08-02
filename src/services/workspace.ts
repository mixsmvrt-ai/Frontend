import { apiRequest } from "@/services/api";

async function api<T>(path: string, init?: RequestInit): Promise<T> { return apiRequest<T>(`/workspace${path}`, init); }
export type WorkspaceHistoryItem = {
	id: string;
	created_at: string;
	generation_requests?: {
		prompt: string;
		kind: string;
	};
};

export type WorkspaceFavoriteItem = {
	entity_type: string;
	entity_id: string;
	created_at: string;
};

export const workspaceApi = { notes: (projectId: string) => api<{ data: { content_markdown: string } | null }>(`/projects/${projectId}/notes`), saveNotes: (projectId: string, contentMarkdown: string) => api(`/projects/${projectId}/notes`, { method: "PUT", body: JSON.stringify({ contentMarkdown }) }), versions: (projectId: string) => api<{ data: Array<{ id: string; version_number: number; prompt: string; created_at: string; generation_id?: string | null }> }>(`/projects/${projectId}/versions`), history: (query = "") => api<{ data: WorkspaceHistoryItem[] }>(`/history?query=${encodeURIComponent(query)}`), favorites: () => api<{ data: WorkspaceFavoriteItem[] }>("/favorites"), storageDownload: (fileId: string) => api<{ data: { url: string; fileName: string } }>(`/storage/${fileId}/download`) };
