import { apiRequest } from "@/services/api";
import { supabase } from "@/lib/supabase/browser";

export interface AudioUploadSession {
  audio: {
    id: string;
    originalFile: {
      bucket: string;
      path: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    };
    processedFile?: {
      bucket: string;
      path: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    } | null;
    status: string;
    duration?: number | null;
    sampleRate?: number | null;
    channels?: number | null;
  };
  uploadUrl: string;
  uploadToken: string;
}

export interface AudioProcessResult {
  audio: AudioUploadSession["audio"];
  urls: {
    originalUrl?: string;
    processedUrl?: string;
  };
}

export interface PitchAnalysisRecord {
  id: string;
  provider: "aubio" | "crepe" | "essentia";
  estimatedBpm: number | null;
  estimatedKey: string | null;
  estimatedScale: string | null;
  overallConfidence: number;
  analysis: Record<string, unknown>;
}

export interface MusicInterpretationRecord {
  id: string;
  confidence: number;
  interpretation: {
    musicalSummary: {
      concise: string;
      phrases: string;
      groove: string;
      harmony: string;
      production: string;
    };
    genreConfidence: Array<{ genre: string; confidence: number }>;
    emotion: { primary: string; secondary: string | null; confidence: number };
    keyAnalysis: { currentKey: string | null };
    scaleAnalysis: { currentScale: string | null };
    musicBrainHints: {
      genre: string | null;
      mood: string | null;
      tempo: number | null;
      key: string | null;
      scale: string | null;
      complexity: string;
      style: string;
    };
    recommendations: {
      chordOptions: string[];
      instrumentCategories: string[];
      productionIdeas: string[];
      arrangementIdeas: string[];
    };
  };
}

export async function startVoiceUpload(file: File, projectId?: string) {
  return apiRequest<{ data: AudioUploadSession }>("/audio/upload", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      fileName: file.name,
      mimeType: file.type || "audio/wav",
      sizeBytes: file.size,
    }),
  });
}

export async function uploadVoiceFile(session: AudioUploadSession, file: File) {
  if (!supabase) {
    throw new Error("Supabase is not configured for this deployment.");
  }
  const result = await supabase.storage
    .from(session.audio.originalFile.bucket)
    .uploadToSignedUrl(session.audio.originalFile.path, session.uploadToken, file);
  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function processVoice(audioId: string) {
  return apiRequest<{ data: AudioProcessResult }>("/audio/process", {
    method: "POST",
    body: JSON.stringify({ audioId, applyHighPassFilter: true }),
  });
}

export async function analyzeVoice(audioId: string) {
  return apiRequest<{ data: PitchAnalysisRecord }>("/pitch/analyze", {
    method: "POST",
    body: JSON.stringify({ audioId }),
  });
}

export async function interpretVoice(pitchAnalysisId: string, projectId?: string) {
  return apiRequest<{ data: MusicInterpretationRecord }>("/music/interpret", {
    method: "POST",
    body: JSON.stringify({ pitchAnalysisId, projectId }),
  });
}
