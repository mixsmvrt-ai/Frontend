import { apiRequest, type MembershipSnapshot } from "@/services/api";

export interface DashboardProject {
  id: string;
  title: string;
  description?: string | null;
  updated_at: string;
  created_at: string;
}

export interface DashboardGeneration {
  id: string;
  status: string;
  created_at: string;
  project_id: string | null;
  generation_requests?: { prompt: string; kind: string } | null;
  generation_files?: Array<{ file_name: string; file_size_bytes: number }>;
}

export interface DashboardDownload {
  id: string;
  file_name: string;
  file_size_bytes: number;
  generated_at: string;
  project_id: string | null;
  song_pack_id?: string | null;
  song_pack_part_id?: string | null;
  metadata?: { kind?: string; includedParts?: string[]; label?: string; partKey?: string } | null;
  projects?: { title: string } | null;
}

export interface DashboardActivity {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardOverview {
  stats: {
    totalProjects: number;
    totalGenerations: number;
    totalDownloads: number;
    storageBytes: number;
  };
  recentProjects: DashboardProject[];
  recentGenerations: DashboardGeneration[];
  recentDownloads: DashboardDownload[];
  recentActivity: DashboardActivity[];
  membership: MembershipSnapshot;
}

export const dashboardApi = {
  overview: () => apiRequest<{ data: DashboardOverview }>("/dashboard/overview"),
  downloads: () => apiRequest<{ data: DashboardDownload[] }>("/dashboard/downloads"),
  downloadUrl: (id: string) => apiRequest<{ data: { url: string; fileName: string } }>(`/dashboard/downloads/${id}/url`),
  deleteDownload: (id: string) => apiRequest<void>(`/dashboard/downloads/${id}`, { method: "DELETE" }),
};
