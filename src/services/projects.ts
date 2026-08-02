export interface ProjectInput { title: string; description: string; tags: string[]; genre?: string; bpm?: number; musicalKey?: string; archived?: boolean; }
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
async function request<T>(path: string, options?: RequestInit): Promise<T> { const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", "x-user-id": "demo-user", ...(options?.headers ?? {}) }, credentials: "include" }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Unable to complete request"); } return response.status === 204 ? undefined as T : response.json() as Promise<T>; }
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
};
