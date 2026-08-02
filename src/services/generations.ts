import { apiRequest } from "@/services/api";

export interface GenerateInput { prompt: string; kind: string; projectId?: string; workflow?: "text_to_midi" | "voice_to_midi" | "song_pack"; tempo?: number; genre?: string; mood?: string; key?: string; scale?: string; difficulty?: "beginner" | "intermediate" | "advanced"; targetDaw?: string; pluginSuggestions?: boolean; lengthBars: number; complexity: "low" | "medium" | "high"; variationAmount: number; timeSignature: [number, number]; }
export interface GenerationResult { id: string; status: "completed"; midiFileUrl: string; fileName: string; tempo: number; key: string; chordProgression: string[]; structure: Array<{ name: string; bars: number }>; pluginRecommendations: Array<{ instrumentType: string; presetType: string; genreMatch: string; moodMatch: string; alternative: string }>; }
export interface GenerationFile { id: string; fileName: string; mimeType: string; url: string; kind: "single" | "multi" | "package"; }
export interface GenerationRecord {
	id: string;
	status: string;
	created_at: string;
	project_id: string | null;
	generation_requests?: { prompt: string; kind: string; settings?: Record<string, unknown> } | null;
	generation_files?: Array<{ id: string; file_name: string; mime_type: string; storage_path: string }>;
}
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export async function generateMusic(input: GenerateInput): Promise<GenerationResult> { const response = await fetch(`${baseUrl}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(input) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error ?? "Unable to generate MIDI."); return payload.data as GenerationResult; }

export async function readGeneration(generationId: string) {
	const response = await apiRequest<{ data: GenerationRecord }>(`/generations/${encodeURIComponent(generationId)}`);
	return response.data;
}

export async function generationExports(generationId: string) {
	const response = await apiRequest<{ data: GenerationFile[] }>(`/generations/${encodeURIComponent(generationId)}/exports`);
	return response.data;
}

export async function favoriteGeneration(generationId: string) {
	await apiRequest<void>(`/generations/${encodeURIComponent(generationId)}/favorite`, { method: "POST" });
}

export async function regenerateGeneration(generationId: string) {
	const response = await apiRequest<{ data: GenerationResult }>(`/generations/${encodeURIComponent(generationId)}/regenerate`, { method: "POST" });
	return response.data;
}
