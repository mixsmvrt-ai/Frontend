import { apiRequest } from "@/services/api";

export interface ProjectInput { title: string; description: string; tags: string[]; genre?: string; bpm?: number; musicalKey?: string; archived?: boolean; }
async function request<T>(path: string, options?: RequestInit): Promise<T> { return apiRequest<T>(path, options); }
export interface ProjectTag { tag: string; }
export interface ProjectRecord {
	id: string;
	title: string;
	description: string | null;
	genre: string | null;
	bpm: number | null;
	musical_key: string | null;
	updated_at: string;
	created_at: string;
	deleted_at?: string | null;
	archived_at?: string | null;
	project_tags?: ProjectTag[];
}
export interface ProjectMessage { id: string; role: "user" | "assistant"; content: string; generation_id: string | null; created_at: string; }
export interface ProjectConversationAssistantReply {
	id: string;
	role: "assistant";
	content: string;
	generation_id: string | null;
	created_at: string;
}

export interface ProjectConversationResult {
	mode: "generation" | "assistant";
	generation?: { id: string; status: "completed"; midiFileUrl: string; fileName: string; tempo: number; key: string };
	message?: ProjectConversationAssistantReply;
	recommendedDelayMs?: number;
}

export const projectsApi = {
	list: (query = "", sort: "updated_at" | "created_at" = "updated_at") => request<{ data: ProjectRecord[] }>(`/projects?query=${encodeURIComponent(query)}&sort=${sort}`),
	read: (id: string) => request<{ data: ProjectRecord }>(`/projects/${encodeURIComponent(id)}`),
	trashed: () => request<{ data: ProjectRecord[] }>("/projects/trash"),
	restore: (id: string) => request<{ data: ProjectRecord }>(`/projects/${encodeURIComponent(id)}/restore`, { method: "POST" }),
	create: (project: ProjectInput) => request<{ data: { id: string } }>("/projects", { method: "POST", body: JSON.stringify(project) }),
	update: (id: string, project: Partial<ProjectInput>) => request<{ data: ProjectRecord }>(`/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(project) }),
	remove: (id: string) => request<void>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
	duplicate: (id: string) => request<{ data: { id: string } }>(`/projects/${encodeURIComponent(id)}/duplicate`, { method: "POST" }),
	messages: (id: string) => request<{ data: ProjectMessage[] }>(`/projects/${encodeURIComponent(id)}/messages`),
	createMessage: (id: string, input: { content: string; generation?: { kind: "melody" | "chords" | "counter_melody" | "bassline" | "drums" | "full_composition"; key?: string; scale?: "major" | "minor"; tempo?: number; lengthBars?: number; complexity?: "low" | "medium" | "high"; variationAmount?: number; timeSignature?: [number, number] } }) => request<{ data: ProjectConversationResult }>(`/projects/${encodeURIComponent(id)}/messages`, { method: "POST", body: JSON.stringify(input) }),
};
