"use client";

import { Midi } from "@tonejs/midi";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlaybackProfile = "808" | "bass" | "guitar" | "bell" | "piano";

const SAMPLE_ROOT: Record<PlaybackProfile, number> = {
  "808": 36,
  bass: 40,
  guitar: 60,
  bell: 60,
  piano: 60,
};

const SAMPLE_FILE: Record<PlaybackProfile, string> = {
  "808": "/sounds/808.wav",
  bass: "/sounds/Bass.wav",
  guitar: "/sounds/Nylon%20Guitar.wav",
  bell: "/sounds/Soft%20Bell.wav",
  piano: "/sounds/Soft%20Piano.wav",
};

export function closestPlaybackProfile(prompt: string, kind?: string): PlaybackProfile {
  const text = `${prompt} ${kind ?? ""}`.toLowerCase();
  if (/drum|trap|dancehall|riddim|808|kick|snare|hat/.test(text)) return "808";
  if (/bass|sub|low end/.test(text)) return "bass";
  if (/guitar|nylon|plucked/.test(text)) return "guitar";
  if (/bell|plucky|mallet|chime/.test(text)) return "bell";
  return "piano";
}

function stopSources(sources: AudioBufferSourceNode[]) {
  sources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // A source that already ended cannot be stopped twice.
    }
    source.disconnect();
  });
}

export function MidiPlayback({ url, onRequestUrl, prompt, kind, fileName }: { url?: string; onRequestUrl?: () => Promise<string | undefined>; prompt?: string; kind?: string; fileName: string }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => () => {
    stopSources(sourcesRef.current);
    sourcesRef.current = [];
    void contextRef.current?.close();
  }, []);

  const togglePlayback = async () => {
    if (loading) return;
    if (playing) {
      stopSources(sourcesRef.current);
      sourcesRef.current = [];
      setPlaying(false);
      return;
    }

    setLoading(true);
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    try {
      // Start/resume immediately from the user gesture before network requests.
      await context.resume();
      const resolvedUrl = url ?? await onRequestUrl?.();
      if (!resolvedUrl) throw new Error("The MIDI export is not available yet.");
      const response = await fetch(resolvedUrl);
      if (!response.ok) throw new Error("The MIDI file could not be loaded.");
      const midi = new Midi(await response.arrayBuffer());
      const profile = closestPlaybackProfile(prompt ?? fileName, kind);
      const sampleResponse = await fetch(SAMPLE_FILE[profile]);
      if (!sampleResponse.ok) throw new Error("The reference sound could not be loaded.");
      const sample = await context.decodeAudioData(await sampleResponse.arrayBuffer());
      const output = context.createGain();
      output.gain.value = 0.72;
      output.connect(context.destination);
      const notes = midi.tracks.flatMap((track) => track.notes);
      const startAt = context.currentTime + 0.04;
      const sources: AudioBufferSourceNode[] = [];
      const root = SAMPLE_ROOT[profile];

      notes.forEach((note) => {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = sample;
        source.playbackRate.value = Math.pow(2, (note.midi - root) / 12);
        gain.gain.value = Math.max(0.08, Math.min(0.9, note.velocity));
        source.connect(gain);
        gain.connect(output);
        source.start(startAt + note.time);
        source.stop(startAt + note.time + Math.max(0.08, note.duration));
        sources.push(source);
      });

      sourcesRef.current = sources;
      setPlaying(true);
      const lastNote = notes.reduce((latest, note) => Math.max(latest, note.time + note.duration), 0);
      window.setTimeout(() => {
        if (sourcesRef.current === sources) {
          sourcesRef.current = [];
          setPlaying(false);
        }
        output.disconnect();
      }, Math.ceil((lastNote + 0.2) * 1000));
    } catch (error) {
      setPlaying(false);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={() => void togglePlayback()} disabled={(!url && !onRequestUrl) || loading} title={playing ? "Pause MIDI" : "Play MIDI"} aria-label={playing ? `Pause ${fileName}` : `Play ${fileName}`} className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-500/15 text-violet-200 transition hover:bg-violet-500/25 disabled:cursor-wait disabled:opacity-50">
      {playing ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5" />}
    </button>
  );
}
