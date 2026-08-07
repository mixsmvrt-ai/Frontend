"use client";

import {
  ArrowUp,
  FileMusic,
  History,
  Pause,
  Play,
  Mic,
  Music4,
  SlidersHorizontal,
  Trash2,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useMembership } from "@/features/billing/use-membership";
import { supabase } from "@/lib/supabase/browser";
import { generateMusic } from "@/services/generations";
import { projectsApi } from "@/services/projects";
import { analyzeVoice, interpretVoice, processVoice, startVoiceUpload, uploadVoiceFile, type MusicInterpretationRecord } from "@/services/voice";

type VoicePipelineStep = "Record or upload" | "Analyze notes" | "Generate MIDI";
const lockThresholdPx = 90;

function projectTitleFromFile(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.length > 2 ? `Voice idea: ${base}` : "Voice to MIDI idea";
}

function buildPrompt(interpretation: MusicInterpretationRecord["interpretation"], enhanceMelody: boolean) {
  const hints = interpretation.musicBrainHints;
  const topGenre = interpretation.genreConfidence[0]?.genre ?? hints.genre ?? "Contemporary";
  const chordOptions = interpretation.recommendations.chordOptions.slice(0, 4).join(", ");
  const instruments = interpretation.recommendations.instrumentCategories.slice(0, 3).join(", ");
  return [
    "Create a MIDI composition derived from this sung or hummed melody.",
    interpretation.musicalSummary.concise,
    interpretation.musicalSummary.phrases,
    interpretation.musicalSummary.groove,
    interpretation.musicalSummary.harmony,
    `Target genre: ${topGenre}. Mood: ${hints.mood ?? interpretation.emotion.primary}.`,
    chordOptions ? `Suggested chords: ${chordOptions}.` : "",
    instruments ? `Prefer instruments around: ${instruments}.` : "",
    enhanceMelody ? "Refine the melody so it feels cleaner, more intentional, and emotionally expressive." : "Keep the melodic shape as close to the original vocal phrase as possible.",
    "Keep the result musical, polished, and easy to edit as MIDI.",
  ].filter(Boolean).join(" ");
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function audioBufferToWavBlob(audioBuffer: AudioBuffer) {
  const numberOfChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const frames = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + frames * blockAlign);
  const view = new DataView(buffer);
  const channels = Array.from({ length: numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));

  let offset = 0;
  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + frames * blockAlign, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numberOfChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, frames * blockAlign, true);
  offset += 4;

  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function recordedBlobToWavFile(blob: Blob) {
  const context = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    return new File([wavBlob], `voice-recording-${Date.now()}.wav`, { type: "audio/wav" });
  } finally {
    await context.close();
  }
}

function levelFromSamples(data: Uint8Array) {
  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    const normalized = (data[index] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 3.2);
}

function formatResetDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export default function VoiceToMidiPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const { membership } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingLocked, setRecordingLocked] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [, setInputLevel] = useState(0);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<MusicInterpretationRecord | null>(null);
  const [tempoOverride] = useState<number | null>(null);
  const [keyOverride] = useState("");
  const enhanceMelody = true;
  const [statusLabel, setStatusLabel] = useState<VoicePipelineStep | "Ready" | "Waiting">("Waiting");
  const [prompt, setPrompt] = useState("");
  const [conversation, setConversation] = useState<Array<{ role: "user" | "assistant"; content: string; fileName?: string; audioUrl?: string }>>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const holdShouldStopRef = useRef(true);
  const pressedRef = useRef(false);
  const discardRecordingRef = useRef(false);

  const creditLabel = useMemo(() => {
    if (membership?.credits) return `${membership.credits.balance} Credits`;
    return "1,500 Credits";
  }, [membership]);
  const creditResetLabel = membership?.credits ? formatResetDate(membership.credits.resetsOn) : null;
  const voiceCost = membership?.credits?.voiceToMidiCost ?? 50;

  useEffect(() => {
    if (!supabase) {
      setIsAuthenticated(false);
      setAuthResolved(true);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setIsAuthenticated(Boolean(data.user));
      setAuthResolved(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      setAuthResolved(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const promptForAuth = useCallback((message: string) => {
    toast("Sign in to use Voice to MIDI", {
      description: message,
    });
    window.location.assign(`/login?next=${encodeURIComponent("/voice-to-midi")}`);
  }, []);

  const drawIdleWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,0.02)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(139,92,246,0.8)";
    context.lineWidth = 2;
    context.beginPath();
    for (let x = 0; x < canvas.width; x += 10) {
      const y = canvas.height / 2 + Math.sin(x / 18) * 8;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }, []);

  const drawAudioBuffer = useCallback(async (sourceFile: File) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const audioContext = new AudioContext();
    try {
      const audioBuffer = await audioContext.decodeAudioData((await sourceFile.arrayBuffer()).slice(0));
      const channel = audioBuffer.getChannelData(0);
      const step = Math.max(1, Math.floor(channel.length / canvas.width));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(255,255,255,0.02)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "rgba(139,92,246,0.95)";
      context.lineWidth = 2;
      context.beginPath();
      for (let x = 0; x < canvas.width; x += 1) {
        let min = 1;
        let max = -1;
        for (let index = 0; index < step; index += 1) {
          const datum = channel[x * step + index] ?? 0;
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        const y1 = ((1 + min) * 0.5) * canvas.height;
        const y2 = ((1 + max) * 0.5) * canvas.height;
        context.moveTo(x, y1);
        context.lineTo(x, y2);
      }
      context.stroke();
    } catch {
      drawIdleWaveform();
    } finally {
      await audioContext.close();
    }
  }, [drawIdleWaveform]);

  const stopVisualizer = useCallback(async () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setInputLevel(0);
  }, []);

  const startVisualizer = useCallback(async (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      if (!canvas || !context || !analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);
      const level = levelFromSamples(data);
      setInputLevel((current) => current * 0.5 + level * 0.5);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(255,255,255,0.02)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 2;
      context.strokeStyle = "rgba(139,92,246,0.95)";
      context.beginPath();
      const slice = canvas.width / data.length;
      let x = 0;
      for (let index = 0; index < data.length; index += 1) {
        const value = data[index] / 128;
        const y = (value * canvas.height) / 2;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
        x += slice;
      }
      context.lineTo(canvas.width, canvas.height / 2);
      context.stroke();
      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  useEffect(() => {
    drawIdleWaveform();
  }, [drawIdleWaveform]);

  useEffect(() => {
    if (!file) {
      drawIdleWaveform();
      return;
    }
    void drawAudioBuffer(file);
  }, [drawAudioBuffer, drawIdleWaveform, file]);

  useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void stopVisualizer();
  }, [previewUrl, stopVisualizer]);

  const finalizeRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    const stream = streamRef.current;
    if (!recorder || !stream) return;
    try {
      if (discardRecordingRef.current) {
        discardRecordingRef.current = false;
        return;
      }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const wavFile = await recordedBlobToWavFile(blob);
      const nextPreviewUrl = URL.createObjectURL(wavFile);
      setFile(wavFile);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextPreviewUrl;
      });
      setStatusLabel("Ready");
      toast.success("Recording captured.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to process the recording.");
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      await stopVisualizer();
      setRecording(false);
      setRecordingLocked(false);
      pressedRef.current = false;
      pointerStartRef.current = null;
      holdShouldStopRef.current = true;
    }
  }, [stopVisualizer]);

  const beginRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not support microphone recording.");
      return;
    }
    if (recording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setRecording(true);
      setRecordingLocked(false);
      setRecordingSeconds(0);
      setError("");
      setStatusLabel("Record or upload");
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        void finalizeRecording();
      };

      await startVisualizer(stream);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);
      recorder.start();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to access the microphone.");
      pressedRef.current = false;
      pointerStartRef.current = null;
      holdShouldStopRef.current = true;
    }
  }, [finalizeRecording, previewUrl, recording, startVisualizer]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
  }, []);

  const discardRecording = () => {
    if (recording) {
      discardRecordingRef.current = true;
      stopRecording();
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setStatusLabel("Waiting");
    setRecordingSeconds(0);
    setError("");
  };

  const handleRecordPointerDown = async (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!isAuthenticated) {
      promptForAuth("Login or create an account to record audio, upload files, and generate MIDI.");
      return;
    }
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    pressedRef.current = true;
    holdShouldStopRef.current = true;
    (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
    await beginRecording();
  };

  const handleRecordPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!recording || !pressedRef.current || recordingLocked || !pointerStartRef.current) return;
    const deltaY = pointerStartRef.current.y - event.clientY;
    if (deltaY >= lockThresholdPx) {
      setRecordingLocked(true);
      holdShouldStopRef.current = false;
      toast.success("Recording locked. Tap stop when you're done.");
    }
  };

  const handleRecordPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if ((event.currentTarget as HTMLButtonElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLButtonElement).releasePointerCapture(event.pointerId);
    }
    pressedRef.current = false;
    pointerStartRef.current = null;
    if (recording && !recordingLocked && holdShouldStopRef.current) {
      stopRecording();
    }
  };

  const handleRecordPointerCancel = () => {
    pressedRef.current = false;
    pointerStartRef.current = null;
    if (recording && !recordingLocked && holdShouldStopRef.current) {
      stopRecording();
    }
  };

  const runPipeline = async () => {
    if (!file) {
      setError("Choose an audio file or record a phrase first.");
      return;
    }
    if (!isAuthenticated) {
      promptForAuth("Login or create an account to run the voice-to-MIDI pipeline.");
      return;
    }

    setBusy(true);
    setError("");
    setInterpretation(null);
    setDownloadUrl(null);
    const audioUrl = URL.createObjectURL(file);
    setConversation((current) => [...current, { role: "user", content: `Voice recording: ${file.name}`, fileName: file.name, audioUrl }]);

    try {
      setStatusLabel("Record or upload");
      const createdProject = await projectsApi.create({
        title: projectTitleFromFile(file.name),
        description: `Voice-to-MIDI source: ${file.name}`,
        tags: ["voice", "midi"],
      });
      const projectId = createdProject.data.id;

      const upload = await startVoiceUpload(file, projectId);
      await uploadVoiceFile(upload.data, file);

      setStatusLabel("Analyze notes");
      const processed = await processVoice(upload.data.audio.id);
      if (!processed.data.audio.processedFile) {
        throw new Error("Processed audio file was not created.");
      }

      const pitch = await analyzeVoice(upload.data.audio.id);
      const interpreted = await interpretVoice(pitch.data.id, projectId);
      setInterpretation(interpreted.data);

      setStatusLabel("Generate MIDI");
      const prompt = buildPrompt(interpreted.data.interpretation, enhanceMelody);
      const hints = interpreted.data.interpretation.musicBrainHints;
      const generation = await generateMusic({
        prompt,
        kind: "full_composition",
        projectId,
        workflow: "voice_to_midi",
        tempo: tempoOverride ?? hints.tempo ?? 120,
        genre: hints.genre ?? undefined,
        mood: hints.mood ?? undefined,
        key: keyOverride.trim() || hints.key || undefined,
        scale: hints.scale?.toLowerCase() ?? undefined,
        lengthBars: 16,
        complexity: enhanceMelody ? "medium" : "low",
        variationAmount: enhanceMelody ? 0.48 : 0.2,
        timeSignature: [4, 4],
      });

      setDownloadUrl(generation.midiFileUrl);
      setStatusLabel("Ready");
      setConversation((current) => [...current, { role: "assistant", content: `I converted your recording into a MIDI idea at ${generation.tempo} BPM.`, fileName: generation.fileName }]);
      discardRecording();
      toast.success("Voice-to-MIDI pipeline completed.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Voice-to-MIDI failed.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const sendPrompt = async () => {
    const content = prompt.trim();
    if (!content || busy) return;
    if (!isAuthenticated) {
      promptForAuth("Login to send prompts and generate MIDI.");
      return;
    }
    setPrompt("");
    setConversation((current) => [...current, { role: "user", content }]);
    setBusy(true);
    setError("");
    try {
      const createdProject = await projectsApi.create({ title: content.slice(0, 48), description: content, tags: ["voice-to-midi"] });
      const generation = await generateMusic({ prompt: content, kind: "full_composition", projectId: createdProject.data.id, workflow: "text_to_midi", tempo: tempoOverride ?? 120, key: keyOverride.trim() || undefined, lengthBars: 8, complexity: enhanceMelody ? "medium" : "low", variationAmount: enhanceMelody ? 0.48 : 0.2, timeSignature: [4, 4] });
      setDownloadUrl(generation.midiFileUrl);
      setConversation((current) => [...current, { role: "assistant", content: `I created a MIDI idea from your prompt at ${generation.tempo} BPM.`, fileName: generation.fileName }]);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to create MIDI.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-[1120px] flex-col overflow-hidden rounded-[22px] border border-white/[.08] bg-[#0b0d14] shadow-[0_24px_80px_rgba(0,0,0,.28)]">
        <header className="flex items-center justify-between border-b border-white/[.08] px-5 py-4 md:px-7">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><Waves className="size-5" /></div><div><h1 className="text-lg font-bold text-white">Voice to MIDI</h1><p className="text-xs text-[#a8a8b5]">Speak your idea. I&apos;ll turn it into MIDI.</p></div></div>
          <div className="flex items-center gap-2"><button type="button" className="hidden items-center gap-2 rounded-lg border border-white/[.1] px-3 py-2 text-xs text-[#d6d2df] sm:flex"><History className="size-3.5" />History</button><button type="button" aria-label="Voice settings" className="grid size-9 place-items-center rounded-lg border border-white/[.1] text-[#aaa8b8]"><SlidersHorizontal className="size-4" /></button></div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-36 md:px-10">
          <div className="mx-auto max-w-3xl space-y-7">
            {!conversation.length && !file ? <div className="flex min-h-[34vh] flex-col items-center justify-center text-center"><div className="grid size-16 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><Mic className="size-8" /></div><h2 className="mt-5 text-3xl font-bold text-white">What are you hearing?</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#a7a5b4]">Describe a melody or use the microphone below. I&apos;ll turn your idea into clean, editable MIDI.</p></div> : null}
            {conversation.map((message, index) => message.role === "user" ? <div key={`${message.role}-${index}`} className="flex justify-end">{message.audioUrl ? <VoiceMessage src={message.audioUrl} fileName={message.fileName} /> : <div className="max-w-[82%] rounded-2xl rounded-br-md bg-[#211e3a] px-4 py-3 text-sm leading-6 text-[#f0edf7]">{message.content}</div>}</div> : <div key={`${message.role}-${index}`} className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-300"><Music4 className="size-4" /></div><div className="min-w-0 max-w-[88%]"><div className="mb-2 flex items-center gap-2 text-xs text-[#8f8c9c]"><span className="font-semibold text-[#c9c5d3]">MidiFlow AI</span><span>{statusLabel === "Ready" ? "Just now" : "Working"}</span></div><div className="rounded-2xl rounded-tl-md border border-white/[.08] bg-[#151821] p-4 text-sm leading-6 text-[#e5e2eb]"><p>{message.content}</p>{message.fileName ? <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[.08] bg-[#10121a] p-3"><div className="grid size-10 place-items-center rounded-lg bg-violet-500/15 text-violet-300"><FileMusic className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{message.fileName}</p><p className="text-[11px] text-[#8e8b9a]">MIDI file · {voiceCost} credits</p></div>{downloadUrl ? <a href={downloadUrl} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full border border-white/[.1] text-violet-300" aria-label="Download MIDI"><ArrowUp className="size-4 rotate-45" /></a> : null}</div> : null}</div></div></div>)}
            {busy ? <div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-300"><Music4 className="size-4" /></div><div className="rounded-2xl rounded-tl-md border border-white/[.08] bg-[#151821] px-4 py-3"><div className="flex items-center gap-1.5" aria-label="MidiFlow AI is processing"><span className="size-2 animate-bounce rounded-full bg-violet-300" /><span className="size-2 animate-bounce rounded-full bg-violet-300 [animation-delay:150ms]" /><span className="size-2 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]" /></div></div></div> : null}
            {file ? <div className="rounded-xl border border-white/[.08] bg-[#151821] p-3 text-xs text-[#bdb9c8]">Audio ready: <span className="text-white">{file.name}</span><span className="ml-2 text-violet-300">{recording ? `Recording ${formatTimer(recordingSeconds)}` : statusLabel}</span></div> : null}
            {interpretation ? <div className="rounded-xl border border-white/[.08] bg-[#151821] p-4 text-sm text-[#d6d1df]"><p className="font-semibold text-white">Detected idea</p><p className="mt-2 text-xs leading-5 text-[#a5a1b0]">{interpretation.interpretation.musicalSummary.concise}</p><p className="mt-3 text-xs text-violet-300">{interpretation.interpretation.genreConfidence[0]?.genre ?? "Contemporary"} · {interpretation.interpretation.emotion.primary} · {interpretation.interpretation.keyAnalysis.currentKey ?? "Auto key"}</p></div> : null}
            {error ? <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[.08] bg-[#0b0d14]/95 px-4 pb-4 pt-3 backdrop-blur-xl md:left-80 md:px-10">
          <div className="mx-auto max-w-3xl"><div className="rounded-2xl border border-white/[.12] bg-[#11141d] p-3 shadow-[0_12px_40px_rgba(0,0,0,.22)]"><div className={`mb-2 flex items-center gap-2 px-2 text-xs ${recording ? "text-violet-200" : "text-[#777482]"}`} aria-live="polite">{recording ? <><span className="size-2 animate-pulse rounded-full bg-red-400" />Recording {formatTimer(recordingSeconds)}</> : file ? <><FileMusic className="size-3.5 text-violet-300" />Recording ready to send</> : null}</div>{recording || file ? <div className="mb-3 rounded-xl border border-white/[.08] bg-[#0d1018] p-2"><canvas ref={canvasRef} width={880} height={120} className="h-16 w-full rounded-lg" aria-label="Audio waveform" />{previewUrl && !recording ? <audio controls src={previewUrl} className="mt-2 h-8 w-full" aria-label="Play recording" /> : null}</div> : null}<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendPrompt(); } }} disabled={recording || busy} rows={2} className="w-full resize-none bg-transparent px-2 text-sm leading-6 text-white outline-none placeholder:text-[#898694] disabled:cursor-default" placeholder={recording ? "Keep holding... release to stop recording" : "Describe the melody you want or use your voice..."} /><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2">{recording || file ? <button type="button" onClick={discardRecording} disabled={busy} aria-label="Delete recording" className="grid size-9 place-items-center rounded-full border border-red-400/30 text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="size-4" /></button> : <label className="grid size-9 cursor-pointer place-items-center rounded-full border border-white/[.1] text-[#aaa6b5] transition hover:bg-white/[.06]" aria-label="Upload audio"><PlusIcon /><input type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/x-m4a" className="hidden" onChange={(event) => { const nextFile = event.target.files?.[0] ?? null; if (nextFile) { setFile(nextFile); setPreviewUrl(URL.createObjectURL(nextFile)); setStatusLabel("Ready"); } }} /></label>}</div><button type="button" onPointerDown={!prompt && !file && !recording ? (event) => void handleRecordPointerDown(event) : undefined} onPointerMove={!prompt && !file && recording ? handleRecordPointerMove : undefined} onPointerUp={!prompt && !file && recording ? handleRecordPointerUp : undefined} onPointerCancel={!prompt && !file && recording ? handleRecordPointerCancel : undefined} onClick={prompt ? () => void sendPrompt() : file ? () => void runPipeline() : undefined} disabled={busy} aria-label={prompt ? "Send message" : file ? "Send recording" : "Record voice"} className={`grid size-12 shrink-0 place-items-center rounded-full text-white shadow-[0_0_25px_rgba(139,92,246,.45)] transition ${prompt || file ? "bg-violet-500 hover:bg-violet-400" : "bg-violet-600 hover:bg-violet-500"}`}>{prompt || file ? <ArrowUp className="size-5" /> : <Mic className="size-5" />}</button></div></div><p className="mt-2 text-center text-[11px] text-[#777482]">{isAuthenticated && creditResetLabel ? `${creditLabel} · ${voiceCost} credits per Voice-to-MIDI run` : "You can speak or type. I&apos;ll handle the rest."}</p></div>
        </div>
      </section>
    </AppShell>
  );
}

function PlusIcon() {
  return <span className="text-xl leading-none">+</span>;
}

function VoiceMessage({ src, fileName }: { src: string; fileName?: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayback = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    await audioRef.current.play();
    setPlaying(true);
  };

  return <div className="min-w-[min(18rem,72vw)] rounded-2xl rounded-br-md border border-violet-300/20 bg-violet-600/90 p-3 text-white shadow-[0_10px_30px_rgba(124,58,237,.2)]">
    <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} className="hidden" />
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void togglePlayback()} className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-violet-700" aria-label={playing ? "Pause voice recording" : "Play voice recording"}>
        {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1.5" aria-label="Voice recording waveform">
        {Array.from({ length: 28 }, (_, index) => <span key={index} className="w-1 rounded-full bg-white/75" style={{ height: `${10 + ((index * 17) % 22)}px` }} />)}
      </div>
    </div>
    <p className="mt-2 truncate text-xs font-medium text-white/80">{fileName ?? "Voice recording"}</p>
  </div>;
}
/*
              <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,14,29,.92),rgba(10,9,20,.98))] p-6 text-center">
                <p className="text-base font-medium text-white">Record</p>
                <div className="mt-7 flex justify-center">
                  <button
                    type="button"
                    onPointerDown={(event) => void handleRecordPointerDown(event)}
                    onPointerMove={handleRecordPointerMove}
                    onPointerUp={handleRecordPointerUp}
                    onPointerCancel={handleRecordPointerCancel}
                    disabled={busy}
                    className="relative grid size-44 place-items-center rounded-full border border-violet-400/35 bg-[radial-gradient(circle_at_center,rgba(139,92,246,.18),rgba(14,10,30,.98))] text-white shadow-[0_0_60px_rgba(139,92,246,.28)] disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-violet-400/30 bg-violet-500/6 transition-transform duration-100"
                      style={{ transform: `scale(${recordScale})`, boxShadow: `0 0 ${28 + inputLevel * 40}px rgba(139,92,246,${recordGlow})` }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-4 rounded-full border border-violet-400/18"
                      style={{ transform: `scale(${1 + inputLevel * 0.35})` }}
                    />
                    <div className="relative z-10 grid size-28 place-items-center rounded-full border border-violet-300/40 bg-[#19112d] shadow-[0_0_40px_rgba(139,92,246,.35)]">
                      <Mic className="size-10 text-violet-200" />
                    </div>
                  </button>
                </div>
                <p className="mt-5 text-xl font-semibold text-white">{recordingLocked ? "Locked recording" : recording ? "Recording" : "Hold to record"}</p>
                <p className="mt-2 text-sm leading-6 text-[#9e97b0]">{recordingLocked ? "Tap stop below when you are finished." : "Hold and swipe up to lock"}</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-violet-200">
                  {recordingLocked ? <Lock className="size-4" /> : null}
                  <span>{recording ? formatTimer(recordingSeconds) : "Ready for input"}</span>
                </div>
                {recordingLocked ? (
                  <button type="button" onClick={stopRecording} className="mt-5 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200">
                    <Square className="size-4" />
                    Stop recording
                  </button>
                ) : null}
              </div>

              <div className="flex items-center justify-center text-[#8d86a2]">
                <div className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[.03] text-sm">or</div>
              </div>

              <label className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,14,29,.92),rgba(10,9,20,.98))] p-6 text-center transition hover:border-violet-400/40">
                <p className="text-base font-medium text-white">Upload Audio</p>
                <div className="mt-7 flex justify-center">
                  <div className="grid size-44 place-items-center rounded-[28px] border border-white/10 bg-white/[.03] text-violet-300 shadow-[inset_0_0_50px_rgba(139,92,246,.08)]">
                    <Upload className="size-11" />
                  </div>
                </div>
                <p className="mt-5 text-xl font-semibold text-white">Upload a file</p>
                <p className="mt-2 text-sm leading-6 text-[#9e97b0]">MP3, WAV, M4A</p>
                <p className="mt-1 text-xs text-[#7e7892]">Max 50MB</p>
                <input
                  type="file"
                  accept="audio/wav,audio/mpeg,audio/mp4,audio/x-m4a"
                  className="hidden"
                  onClick={(event) => {
                    if (isAuthenticated) return;
                    event.preventDefault();
                    promptForAuth("Login or create an account to upload audio and generate MIDI.");
                  }}
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    setInterpretation(null);
                    setDownloadUrl(null);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                    }
                    if (nextFile) {
                      setPreviewUrl(URL.createObjectURL(nextFile));
                      setStatusLabel("Ready");
                    }
                  }}
                />
              </label>
            </div>

            <div className="mt-8 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
              <FieldCard
                title="Key (Optional)"
                value={keyOverride.trim() || "Auto Detect"}
                onClick={() => {
                  const next = window.prompt("Preferred key", keyOverride || "");
                  if (next !== null) setKeyOverride(next);
                }}
              />
              <FieldCard
                title="Tempo (Optional)"
                value={tempoOverride ? `${tempoOverride} BPM` : "Auto Detect"}
                onClick={() => {
                  const next = window.prompt("Preferred tempo in BPM", tempoOverride ? String(tempoOverride) : "");
                  if (next === null) return;
                  const parsed = Number(next);
                  if (!next.trim()) {
                    setTempoOverride(null);
                    return;
                  }
                  if (Number.isInteger(parsed) && parsed >= 40 && parsed <= 240) {
                    setTempoOverride(parsed);
                  } else {
                    toast.error("Tempo must be between 40 and 240 BPM.");
                  }
                }}
              />
              <label className="flex min-h-16 items-center justify-between rounded-2xl border border-white/8 bg-white/[.03] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Enhance Melody</p>
                  <p className="mt-1 text-xs text-[#8e89a4]">Recommended</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnhanceMelody((current) => !current)}
                  aria-pressed={enhanceMelody}
                  className={`relative h-8 w-14 rounded-full transition ${enhanceMelody ? "bg-violet-500" : "bg-white/10"}`}
                >
                  <span className={`absolute top-1 size-6 rounded-full bg-white transition ${enhanceMelody ? "left-7" : "left-1"}`} />
                </button>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void runPipeline()}
              disabled={busy || recording || !file}
              className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,rgba(73,25,118,.75),rgba(94,43,180,.92))] text-lg font-bold text-white shadow-[0_20px_50px_rgba(88,36,163,.22)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Music4 className="size-5" />}
              {busy ? "Generating MIDI" : "Generate MIDI"}
            </button>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-[#8f89a5]">
              <Shield className="size-4" />
              Your audio is secure and will only be used to generate your MIDI.
            </div>

            <div className="mt-8 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Waveform</p>
                  <p className="mt-1 text-xs text-[#8f89a5]">{recording ? "Live microphone input" : file ? file.name : "Upload or record to preview audio"}</p>
                </div>
                <p className="text-xs uppercase tracking-[.18em] text-violet-300">{statusLabel}</p>
              </div>
              <canvas ref={canvasRef} width={880} height={140} className="mt-4 h-32 w-full rounded-xl bg-black/15" />
              {previewUrl ? <audio controls src={previewUrl} className="mt-4 w-full" /> : null}
            </div>

            {downloadUrl || projectHref || error ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {downloadUrl ? <a href={downloadUrl} target="_blank" rel="noreferrer" className="rounded-full border border-violet-400/35 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100">Download MIDI</a> : null}
                {projectHref ? <Link href={projectHref} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white">Open project</Link> : null}
                {error ? <p className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</p> : null}
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,17,29,.96),rgba(12,10,24,.98))] p-6">
              <h3 className="text-xl font-semibold text-white">How it works</h3>
              <div className="mt-6 space-y-5">
                {[
                  ["1", "Record or upload", "Hum, sing or rap your idea."],
                  ["2", "We analyze", "Our AI detects notes, rhythm and key."],
                  ["3", "Get your MIDI", "Download and use it in any DAW."],
                ].map(([step, title, copy]) => (
                  <div key={step} className="flex gap-4">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full border border-violet-400/18 bg-violet-500/10 text-sm font-bold text-violet-200">{step}</div>
                    <div>
                      <p className="font-semibold text-white">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#9e97b0]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,17,29,.96),rgba(12,10,24,.98))] p-6">
              <h3 className="text-xl font-semibold text-white">Tips for better results</h3>
              <div className="mt-6 space-y-4 text-sm text-[#d4cfe0]">
                {[
                  "Record in a quiet place",
                  "Use a clear melody",
                  "Sing or hum the main part",
                  "Keep it simple",
                ].map((tip) => (
                  <div key={tip} className="flex items-start gap-3 rounded-2xl bg-white/[.03] px-4 py-3">
                    <div className="mt-0.5 grid size-7 place-items-center rounded-full bg-violet-500/10 text-violet-200">
                      <Mic className="size-3.5" />
                    </div>
                    <p>{tip}</p>
                  </div>
                ))}
              </div>
            </section>

            {interpretation ? (
              <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,17,29,.96),rgba(12,10,24,.98))] p-6">
                <h3 className="text-xl font-semibold text-white">Detected idea</h3>
                <div className="mt-5 space-y-3 text-sm text-[#d4cfe0]">
                  <p><span className="text-[#8f89a5]">Genre:</span> {interpretation.interpretation.genreConfidence[0]?.genre ?? "Unknown"}</p>
                  <p><span className="text-[#8f89a5]">Mood:</span> {interpretation.interpretation.emotion.primary}</p>
                  <p><span className="text-[#8f89a5]">Key:</span> {interpretation.interpretation.keyAnalysis.currentKey ?? "Unknown"} {interpretation.interpretation.scaleAnalysis.currentScale ?? ""}</p>
                  <p className="rounded-2xl bg-white/[.03] p-3 text-[#bcb5d0]">{interpretation.interpretation.musicalSummary.concise}</p>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
*/
