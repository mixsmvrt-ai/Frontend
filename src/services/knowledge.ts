import { apiRequest } from "@/services/api";

async function request<T>(path: string): Promise<T> {
  return apiRequest<T>(`/knowledge${path}`);
}

export interface KnowledgeGenre {
  name: string;
  description: string;
  bpmRange: [number, number];
  defaultBpm: number;
  commonKeys: string[];
  tonalityPreference: string;
  recommendedScales: string[];
  typicalStructure: string;
  energyLevel: string;
  moodTags: string[];
  instrumentRecommendations: string[];
  pluginCategories: string[];
  difficulty: string;
}

export interface KnowledgeSearchResult {
  query: string;
  genres: KnowledgeGenre[];
  moods: Array<{ name: string; suggestedKeys: string[]; suggestedScales: string[]; suggestedInstruments: string[] }>;
  scales: Array<{ name: string; moodTags: string[]; genres: string[]; difficulty: string }>;
  chords: Array<{ romanNumerals: string[]; exampleKey: string; moodTags: string[]; genres: string[]; popularity: number }>;
  instruments: Array<{ name: string; category: string; genres: string[]; moodMatch: string[] }>;
  plugins: Array<{ category: string; description: string; genres: string[]; moods: string[] }>;
  recommendations: Array<{ keys: Array<{ name: string; tonality: string }>; scales: Array<{ name: string }>; chordProgressions: Array<{ romanNumerals: string[] }> }>;
}

export const knowledgeApi = {
  genres: () => request<{ data: KnowledgeGenre[] }>("/genres"),
  moods: () => request<{ data: KnowledgeSearchResult["moods"] }>("/moods"),
  scales: () => request<{ data: KnowledgeSearchResult["scales"] }>("/scales"),
  chords: (query = "") => request<{ data: KnowledgeSearchResult["chords"] }>(`/chords${query}`),
  plugins: (query = "") => request<{ data: KnowledgeSearchResult["plugins"] }>(`/plugins${query}`),
  instruments: (query = "") => request<{ data: KnowledgeSearchResult["instruments"] }>(`/instruments${query}`),
  search: (query: string) => request<{ data: KnowledgeSearchResult }>(`/search?query=${encodeURIComponent(query)}`),
};
