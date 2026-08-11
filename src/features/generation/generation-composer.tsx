"use client";

import { motion } from "framer-motion";
import { ArrowUp, CircleDashed, Download, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MidiPlayback } from "@/components/midi-playback";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { useMembership } from "@/features/billing/use-membership";
import { projectsApi } from "@/services/projects";
import type { PromptRefinementQuestion } from "@/services/projects";

const keys = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const processingSteps = [
  { title: "Analyzing prompt", detail: "Reading the mood, key, and arrangement cues." },
  { title: "Planning composition", detail: "Shaping the harmony, structure, and rhythm." },
  { title: "Writing MIDI", detail: "Building notes, phrasing, and timing." },
  { title: "Finalizing export", detail: "Preparing the MIDI file for download." },
] as const;

export interface ComposerReplyState {
  status: "processing" | "refining" | "completed";
  prompt: string;
  activeStep: number;
  steps: ReadonlyArray<{ title: string; detail: string }>;
  fileName?: string;
  downloadUrl?: string;
  generationId?: string;
  questions?: PromptRefinementQuestion[];
  refinementIndex?: number;
  refinementAnswers?: Array<{ category: string; value: string }>;
  kind?: ComposerSubmitInput["kind"];
  key?: string;
  scale?: ComposerSubmitInput["scale"];
  tempo?: number;
  stage?: "refinement" | "next-part";
  generatedParts?: string[];
}

export interface ComposerSubmitInput {
  prompt: string;
  kind?: "melody" | "chords" | "counter_melody" | "bassline" | "drums" | "full_composition";
  key?: string;
  scale?: "major" | "minor";
  tempo?: number;
}

function projectTitleFromPrompt(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 45).trim()}...`;
}

export function GenerationComposer({ projectId, onGenerated, onReplyStateChange, onSubmitPrompt }: { projectId?: string; onGenerated?: () => void; onReplyStateChange?: (state: ComposerReplyState | null) => void; onSubmitPrompt?: (input: ComposerSubmitInput) => Promise<void> }) {
  const router = useRouter();
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership, refresh } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState("");
  const [key, setKey] = useState("");
  const [scale, setScale] = useState("");
  const [tempo, setTempo] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localReplyState, setLocalReplyState] = useState<ComposerReplyState | null>(null);
  const processingTimerRef = useRef<number | null>(null);
  const textCredits = membership?.credits;
  const creditsExhausted = Boolean(isAuthenticated && textCredits && textCredits.textBalance < textCredits.textToMidiCost);
  const textCreditsLow = Boolean(textCredits && textCredits.textUsagePercent >= 80 && !creditsExhausted);

  useEffect(() => () => {
    if (processingTimerRef.current) {
      window.clearInterval(processingTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;

    const closeSettings = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeSettings);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeSettings);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);

  const clearProcessingTimer = () => {
    if (!processingTimerRef.current) return;
    window.clearInterval(processingTimerRef.current);
    processingTimerRef.current = null;
  };

  const publishReplyState = (state: ComposerReplyState | null) => {
    if (onReplyStateChange) {
      onReplyStateChange(state);
      return;
    }
    setLocalReplyState(state);
  };

  const downloadFile = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noreferrer";
    document.body.append(link);
    link.click();
    link.remove();
  };

  const generate = async () => {
    const generationPrompt = prompt.trim();
    if (generationPrompt.length < 3) return toast.error("Describe at least a few notes or a musical feeling.");
    const parsedTempo = tempo.trim() ? Number(tempo) : undefined;
    if (parsedTempo !== undefined && (!Number.isInteger(parsedTempo) || parsedTempo < 40 || parsedTempo > 240)) {
      return toast.error("BPM must be a whole number between 40 and 240.");
    }
    const selectedKind = kind ? kind.toLowerCase().replaceAll(" ", "_") as ComposerSubmitInput["kind"] : undefined;
    const selectedScale = scale ? scale.toLowerCase() as ComposerSubmitInput["scale"] : undefined;

    if (!isAuthenticated) {
      toast("Sign in to create a project", {
        description: "You can explore the prompt builder first. Login is only required once you want to generate and save.",
      });
      router.push(`/login?next=${encodeURIComponent(projectId ? `/projects/${projectId}` : "/")}`);
      return;
    }

    if (!projectId && !onSubmitPrompt) {
      setBusy(true);
      try {
        const project = await projectsApi.create({
          title: projectTitleFromPrompt(generationPrompt),
          description: generationPrompt,
          tags: [],
          ...(parsedTempo !== undefined ? { bpm: parsedTempo } : {}),
          ...(key ? { musicalKey: `${key}${selectedScale ? ` ${selectedScale}` : ""}` } : {}),
        });
        const query = new URLSearchParams({ prompt: generationPrompt });
        if (selectedKind) query.set("kind", selectedKind);
        if (key) query.set("key", key);
        if (selectedScale) query.set("scale", selectedScale);
        if (parsedTempo !== undefined) query.set("tempo", String(parsedTempo));
        setPrompt("");
        router.push(`/projects/${project.data.id}?${query.toString()}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to start a project conversation.");
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    publishReplyState({
      status: "processing",
      prompt: generationPrompt,
      activeStep: 0,
      steps: processingSteps,
    });
    clearProcessingTimer();
    let activeProjectId = projectId;
    let activeStep = 0;
    const updateProcessingStep = () => {
      activeStep = Math.min(activeStep + 1, processingSteps.length - 1);
      publishReplyState({
        status: "processing",
        prompt: generationPrompt,
        activeStep,
        steps: processingSteps,
      });
    };

    clearProcessingTimer();
    processingTimerRef.current = window.setInterval(updateProcessingStep, 1200);

    try {
      if (onSubmitPrompt) {
        clearProcessingTimer();
        await onSubmitPrompt({
          prompt: generationPrompt,
          kind: selectedKind,
          key: key || undefined,
          scale: selectedScale,
          tempo: parsedTempo,
        });
        setPrompt("");
        onGenerated?.();
        void refresh();
        return;
      }

      if (!activeProjectId) {
        const project = await projectsApi.create({
          title: projectTitleFromPrompt(generationPrompt),
          description: generationPrompt,
          tags: [],
          ...(parsedTempo !== undefined ? { bpm: parsedTempo } : {}),
          ...(key ? { musicalKey: `${key}${selectedScale ? ` ${selectedScale}` : ""}` } : {}),
        });
        activeProjectId = project.data.id;
      }

      setPrompt("");
      if (activeProjectId) {
        router.push(`/projects/${activeProjectId}`);
      }
    } catch (error) {
      clearProcessingTimer();
      publishReplyState(null);
      toast.error(error instanceof Error ? error.message : "Unable to continue the conversation.");
    } finally {
      clearProcessingTimer();
      setBusy(false);
    }
  };

  return (
    <section className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[.08] bg-black/95 px-4 py-3 backdrop-blur-xl md:left-80 md:px-8">
      <div ref={composerRef} className="relative rounded-[2rem] border border-violet-500/80 bg-[#0e0e1d]/90 p-2 shadow-[0_0_40px_rgba(104,58,255,.10)]">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe your melody..."
          aria-label="Music generation prompt"
          rows={1}
          className="h-10 min-h-10 w-full resize-none bg-transparent px-3 py-2 text-[16px] leading-6 text-white outline-none placeholder:text-[#8f8da3]"
        />
        {settingsOpen ? (
          <>
            <button
              type="button"
              aria-label="Close prompt settings"
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 z-10 bg-[#04040c]/45 backdrop-blur-[1px] md:hidden"
            />
            <motion.div
              id="generation-composer-settings"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-x-3 bottom-3 z-20 rounded-[1.6rem] border border-white/10 bg-[#141425]/96 p-3 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur md:absolute md:inset-x-3 md:bottom-[4.6rem]"
            >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="mb-3 flex justify-center md:hidden">
                  <span className="h-1.5 w-14 rounded-full bg-white/15" />
                </div>
                <p className="text-sm font-semibold text-white">Prompt settings</p>
                <p className="text-xs text-[#9894aa]">Pick the MIDI type, key, scale, and tempo when you want more control.</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-[#d9d8e7] transition hover:border-violet-400/50 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Generation type" className="rounded-xl border border-white/[.06] bg-[#181827] px-3 py-2.5 text-sm text-[#dfdeeb]">
                <option value="">Let prompt decide type</option>
                <option>Melody</option>
                <option>Chords</option>
                <option>Counter Melody</option>
                <option>Bassline</option>
                <option>Drums</option>
                <option>Full Composition</option>
              </select>
              <select value={key} onChange={(event) => setKey(event.target.value)} aria-label="Musical key" className="rounded-xl border border-white/[.06] bg-[#181827] px-3 py-2.5 text-sm text-[#dfdeeb]">
                <option value="">Auto key from prompt/style</option>
                {keys.map((note) => <option key={note} value={note}>{note}</option>)}
              </select>
              <select value={scale} onChange={(event) => setScale(event.target.value)} aria-label="Major or minor scale" className="rounded-xl border border-white/[.06] bg-[#181827] px-3 py-2.5 text-sm text-[#dfdeeb]">
                <option value="">Auto scale from prompt/style</option>
                <option>Minor</option>
                <option>Major</option>
              </select>
              <label className="flex items-center rounded-xl border border-white/[.06] bg-[#181827] px-3 py-2.5 text-sm text-[#dfdeeb]">
                <input
                  type="number"
                  value={tempo}
                  min="40"
                  max="240"
                  step="1"
                  inputMode="numeric"
                  onChange={(event) => setTempo(event.target.value)}
                  aria-label="Tempo in BPM"
                  placeholder="Auto BPM"
                  className="w-full bg-transparent text-sm text-[#dfdeeb] outline-none placeholder:text-[#9894aa]"
                />
                <span className="ml-2 text-xs text-[#a8a6b8]">BPM</span>
              </label>
            </div>
            </motion.div>
          </>
        ) : null}
        <div className="flex items-center justify-between gap-3 px-2 pb-1">
          <div className="flex min-w-0 items-center gap-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Open prompt settings"
              aria-expanded={settingsOpen}
              aria-controls="generation-composer-settings"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.04] text-[#dfdeeb] transition hover:border-violet-400/50 hover:bg-white/[.08] hover:text-white"
            >
              <Plus className={`size-5 transition-transform ${settingsOpen ? "rotate-45" : "rotate-0"}`} />
            </motion.button>
          </div>
          {textCreditsLow ? <p className="mb-1 text-right text-xs text-amber-200">Text-to-MIDI credits are {Math.round(textCredits?.textUsagePercent ?? 0)}% used.</p> : null}
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={generate} disabled={busy || creditsExhausted} aria-label="Generate MIDI" className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-[0_0_25px_rgba(119,75,255,.65)] disabled:opacity-60">
            <ArrowUp className="size-5" />
          </motion.button>
        </div>
      </div>
      {localReplyState ? (
        <div className="mt-3 rounded-[1.5rem] border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-[#ddd9e7]">
          {localReplyState.status === "processing" ? (
            <>
              <div className="flex items-center gap-2 text-white">
                <CircleDashed className="size-4 animate-spin text-violet-300" />
                <span className="font-medium">Working on your MIDI reply</span>
              </div>
              <div className="mt-4 space-y-3">
                {localReplyState.steps.map((step, index) => {
                  const isDone = index < localReplyState.activeStep;
                  const isActive = index === localReplyState.activeStep;
                  return (
                    <div key={step.title} className="flex items-start gap-3">
                      <span className={`mt-1 block size-2.5 rounded-full ${isDone ? "bg-emerald-400" : isActive ? "animate-pulse bg-violet-300" : "bg-white/15"}`} />
                      <div>
                        <p className={`${isActive ? "text-white" : "text-[#c2bdd2]"}`}>{step.title}</p>
                        <p className="text-xs text-[#9089a4]">{step.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <MidiPlayback url={localReplyState.downloadUrl} prompt={localReplyState.prompt} kind={kind} fileName={localReplyState.fileName ?? "MIDI file ready"} />
                <p className="truncate font-medium text-white">{localReplyState.fileName ?? "MIDI file ready"}</p>
              </div>
              {localReplyState.downloadUrl && localReplyState.fileName ? (
                <button type="button" title="Download MIDI" aria-label="Download MIDI" onClick={() => downloadFile(localReplyState.downloadUrl!, localReplyState.fileName!)} className="mt-3 grid size-9 place-items-center rounded-full border border-white/10 bg-white/[.03] text-white transition hover:bg-white/[.08]">
                  <Download className="size-3.5" />
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
