import { apiRequest } from "@/services/api";

export const songPackParts = [
  { key: "main_melody", label: "Main Melody" },
  { key: "counter_melody", label: "Counter Melody" },
  { key: "chord_progression", label: "Chord Progression" },
  { key: "bassline", label: "Bassline" },
  { key: "lead", label: "Lead" },
  { key: "pluck", label: "Pluck" },
  { key: "bell_layer", label: "Bell Layer" },
  { key: "strings", label: "Strings" },
  { key: "pads", label: "Pads" },
  { key: "brass", label: "Brass" },
  { key: "synth_layer", label: "Synth Layer" },
  { key: "arpeggio", label: "Arpeggio" },
  { key: "guitar", label: "Guitar" },
  { key: "piano_layer", label: "Piano Layer" },
  { key: "choir_layer", label: "Choir Layer" },
  { key: "top_melody", label: "Top Melody" },
  { key: "harmony_layer", label: "Harmony Layer" },
  { key: "drum_guide", label: "Optional Drum Guide MIDI" },
] as const;

export type SongPackPartKey = (typeof songPackParts)[number]["key"];

export interface SongPackCredits {
  monthlyAllocation: number;
  balance: number;
  used: number;
  usagePercent: number;
  resetsOn: string;
  config: {
    enabled: boolean;
    defaultCredits: number;
    costs: {
      single: number;
      small: number;
      medium: number;
      large: number;
      regeneratePart: number;
    };
  };
}

export interface SongPackPreviewNote {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}

export interface SongPackPartResult {
  id: string;
  key: SongPackPartKey;
  label: string;
  generationId: string;
  fileName: string;
  url?: string | null;
  previewNotes: SongPackPreviewNote[];
  summary: {
    noteCount: number;
    minPitch: number;
    maxPitch: number;
    tempo: number;
    key: string;
    scale: string;
  };
}

export interface SongPackRecord {
  id: string;
  projectId: string;
  title: string;
  status: string;
  summary: string;
  genre: string | null;
  mood: string | null;
  tempo: number | null;
  key: string | null;
  scale: string | null;
  creditsUsed: number;
  creditsRemaining: number;
  download: {
    fileName: string;
    storagePath: string;
    url: string;
    includedParts: string[];
  };
  parts: SongPackPartResult[];
}

export interface SongPackListItem {
  id: string;
  title: string;
  status: string;
  genre: string | null;
  mood: string | null;
  tempo: number | null;
  musical_key: string | null;
  scale: string | null;
  selected_parts: string[];
  credits_used: number;
  summary: string | null;
  created_at: string;
  song_pack_parts?: Array<{ id: string; label: string; part_key: string; file_name: string | null; preview_notes: SongPackPreviewNote[]; summary: Record<string, unknown>; url?: string | null }>;
  projects?: { title: string } | null;
}

export interface SongPackInput {
  prompt: string;
  genre?: string;
  mood?: string;
  tempo?: number;
  key?: string;
  scale?: string;
  energy?: "auto" | "low" | "medium" | "high";
  complexity?: "auto" | "low" | "medium" | "high";
  swing?: number;
  humanization?: number;
  lengthBars?: number;
  selectedParts: SongPackPartKey[];
  projectId?: string;
}

export const songPacksApi = {
  credits: () => apiRequest<{ data: SongPackCredits }>("/song-packs/credits"),
  list: () => apiRequest<{ data: SongPackListItem[] }>("/song-packs"),
  read: async (id: string) => {
    const payload = await apiRequest<{ data: Record<string, unknown> }>(`/song-packs/${id}`);
    const data = payload.data as Record<string, unknown> & {
      song_pack_parts?: Array<{ id: string; part_key: SongPackPartKey; label: string; file_name: string; url?: string | null; preview_notes: SongPackPreviewNote[]; summary: { noteCount: number; minPitch: number; maxPitch: number; tempo: number; key: string; scale: string } }>;
      downloadUrl?: string | null;
      pack_file_name?: string | null;
      pack_storage_path?: string | null;
    };
    return {
      data: {
        id: String(data.id),
        projectId: String(data.project_id),
        title: String(data.title),
        status: String(data.status),
        summary: String(data.summary ?? "Song pack loaded."),
        genre: typeof data.genre === "string" ? data.genre : null,
        mood: typeof data.mood === "string" ? data.mood : null,
        tempo: typeof data.tempo === "number" ? data.tempo : null,
        key: typeof data.musical_key === "string" ? data.musical_key : null,
        scale: typeof data.scale === "string" ? data.scale : null,
        creditsUsed: Number(data.credits_used ?? 0),
        creditsRemaining: Number(data.creditsRemaining ?? 0),
        download: {
          fileName: String(data.pack_file_name ?? "song-pack.zip"),
          storagePath: String(data.pack_storage_path ?? ""),
          url: String(data.downloadUrl ?? ""),
          includedParts: ((data.song_pack_parts ?? []) as Array<{ label: string }>).map((part) => part.label),
        },
        parts: ((data.song_pack_parts ?? []) as Array<{ id: string; part_key: SongPackPartKey; label: string; file_name: string; url?: string | null; preview_notes: SongPackPreviewNote[]; summary: SongPackPartResult["summary"] }>).map((part) => ({
          id: part.id,
          key: part.part_key,
          label: part.label,
          generationId: `song-pack-${id}-${part.part_key}`,
          fileName: part.file_name,
          url: part.url ?? null,
          previewNotes: part.preview_notes,
          summary: part.summary,
        })),
      } satisfies SongPackRecord,
    };
  },
  create: (input: SongPackInput) => apiRequest<{ data: SongPackRecord }>("/song-packs", { method: "POST", body: JSON.stringify(input) }),
  regeneratePack: (id: string) => apiRequest<{ data: Pick<SongPackRecord, "parts" | "download" | "creditsRemaining"> }>(`/song-packs/${id}/regenerate`, { method: "POST" }),
  regeneratePart: (songPackId: string, partId: string, promptOverride?: string) => apiRequest<{ data: { part: SongPackPartResult; download: SongPackRecord["download"]; creditsRemaining: number } }>(`/song-packs/${songPackId}/parts/${partId}/regenerate`, { method: "POST", body: JSON.stringify(promptOverride ? { promptOverride } : {}) }),
};