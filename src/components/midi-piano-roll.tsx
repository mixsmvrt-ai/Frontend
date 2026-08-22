"use client";

import { Midi } from "@tonejs/midi";
import { GripVertical, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface PianoRollNote {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

interface MidiPianoRollProps {
  url?: string;
  fileName: string;
}

function dragMidi(event: React.DragEvent<HTMLDivElement>, url: string, fileName: string) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("DownloadURL", `audio/midi:${fileName}:${url}`);
  event.dataTransfer.setData("text/uri-list", url);
  event.dataTransfer.setData("text/plain", fileName);
}

export function MidiPianoRoll({ url, fileName }: MidiPianoRollProps) {
  const [notes, setNotes] = useState<PianoRollNote[]>([]);
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("MIDI preview unavailable");
        return new Midi(await response.arrayBuffer());
      })
      .then((midi) => {
        const parsed = midi.tracks.flatMap((track) => track.notes).map((note) => ({
          pitch: note.midi,
          start: note.time,
          duration: Math.max(note.duration, 0.04),
          velocity: note.velocity,
        }));
        const end = parsed.reduce((latest, note) => Math.max(latest, note.start + note.duration), 1);
        setNotes(parsed);
        setDuration(end);
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [url]);

  const pitches = notes.length ? [Math.max(...notes.map((note) => note.pitch)), Math.min(...notes.map((note) => note.pitch))] : [72, 48];
  const pitchRange = Math.max(pitches[0] - pitches[1] + 1, 1);

  return (
    <div
      draggable={Boolean(url)}
      onDragStart={(event) => url && dragMidi(event, url, fileName)}
      title={url ? "Drag this piano roll into your DAW" : undefined}
      className="mt-3 overflow-hidden rounded-xl border border-violet-300/15 bg-[#0c0e15]"
    >
      <div className="flex items-center justify-between border-b border-white/[.06] px-3 py-2 text-[10px] uppercase tracking-[.16em] text-[#8e8a9d]">
        <span>Piano roll</span>
        {url ? <span className="inline-flex items-center gap-1 text-violet-300"><GripVertical className="size-3" /> Drag to DAW</span> : null}
      </div>
      <div className="relative h-40 overflow-hidden bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_15px,rgba(255,255,255,.055)_16px),repeating-linear-gradient(to_right,transparent_0,transparent_47px,rgba(255,255,255,.035)_48px)]">
        {loading ? <div className="absolute inset-0 grid place-items-center text-violet-300"><Loader2 className="size-4 animate-spin" /></div> : null}
        {error ? <p className="absolute inset-0 grid place-items-center text-xs text-[#9893a6]">Preview unavailable</p> : null}
        {!loading && !error && !notes.length ? <p className="absolute inset-0 grid place-items-center text-xs text-[#9893a6]">No notes in this export</p> : null}
        {notes.map((note, index) => (
          <span
            key={`${note.pitch}-${note.start}-${index}`}
            className="absolute rounded-[3px] border border-violet-200/35 bg-violet-400/75 shadow-[0_0_8px_rgba(167,139,250,.2)]"
            style={{
              left: `${(note.start / duration) * 100}%`,
              top: `${((pitches[0] - note.pitch) / pitchRange) * 100}%`,
              width: `${Math.max((note.duration / duration) * 100, 0.7)}%`,
              height: `${Math.max(100 / pitchRange, 3)}%`,
              opacity: 0.55 + note.velocity * 0.45,
            }}
          />
        ))}
      </div>
    </div>
  );
}