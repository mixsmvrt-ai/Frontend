"use client";

import { motion } from "framer-motion";
import { ArrowUp, CircleDashed, Cloud, Download, Flame, Gem, Rocket, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { useMembership } from "@/features/billing/use-membership";
import { generateMusic } from "@/services/generations";
import { projectsApi } from "@/services/projects";

const styles = [
  { prompt: "Chill lo-fi chords", detail: "80 BPM - C Major", icon: Cloud },
  { prompt: "Drill beat melody", detail: "142 BPM - D Minor", icon: Flame },
  { prompt: "Emotional piano melody", detail: "90 BPM - G Major", icon: Sparkles },
  { prompt: "R&B chord progression", detail: "70 BPM - F Minor", icon: Gem },
  { prompt: "Upbeat pop hook", detail: "120 BPM - C Major", icon: Rocket },
];

const keys = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const processingSteps = [
  { title: "Analyzing prompt", detail: "Reading the mood, key, and arrangement cues." },
  { title: "Planning composition", detail: "Shaping the harmony, structure, and rhythm." },
  { title: "Writing MIDI", detail: "Building notes, phrasing, and timing." },
  { title: "Finalizing export", detail: "Preparing the MIDI file for download." },
] as const;

export interface ComposerReplyState {
  status: "processing" | "completed";
  prompt: string;
  activeStep: number;
  steps: ReadonlyArray<{ title: string; detail: string }>;
  fileName?: string;
  downloadUrl?: string;
  generationId?: string;
}

export interface ComposerSubmitInput {
  prompt: string;
  kind: "melody" | "chords" | "counter_melody" | "bassline" | "drums" | "full_composition";
  key: string;
  scale: "major" | "minor";
  tempo: number;
}

function projectTitleFromPrompt(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 45).trim()}...`;
}

function formatResetDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function usageThreshold(usagePercent: number) {
  if (usagePercent >= 100) return 100;
  if (usagePercent >= 95) return 95;
  if (usagePercent >= 90) return 90;
  if (usagePercent >= 75) return 75;
  return null;
}

export function GenerationComposer({ compact = false, projectId, onGenerated, onReplyStateChange, onSubmitPrompt }: { compact?: boolean; projectId?: string; onGenerated?: () => void; onReplyStateChange?: (state: ComposerReplyState | null) => void; onSubmitPrompt?: (input: ComposerSubmitInput) => Promise<void> }) {
  const router = useRouter();
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership, refresh } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState("Melody");
  const [key, setKey] = useState("A");
  const [scale, setScale] = useState("Minor");
  const [tempo, setTempo] = useState("140");
  const [busy, setBusy] = useState(false);
  const [localReplyState, setLocalReplyState] = useState<ComposerReplyState | null>(null);
  const processingTimerRef = useRef<number | null>(null);
  const textCredits = membership?.credits;
  const threshold = textCredits ? usageThreshold(textCredits.usagePercent) : null;
  const usageBanner = useMemo(() => {
    if (!textCredits || threshold === null) return null;
    const resetLabel = formatResetDate(textCredits.resetsOn);
    if (threshold === 100) {
      return {
        tone: "border-red-400/30 bg-red-500/10 text-red-100",
        title: `You have used all ${textCredits.textToMidiGenerationLimit} text-to-MIDI generations for this month.`,
        detail: `Credits reset at the end of the month on ${resetLabel}.`,
      };
    }
    return {
      tone: threshold >= 95 ? "border-amber-400/30 bg-amber-500/10 text-amber-50" : "border-violet-400/30 bg-violet-500/10 text-violet-50",
      title: `You have used ${threshold}% of this month's text-to-MIDI credits.`,
      detail: `${textCredits.textToMidiGenerationsRemaining} generations left. Credits reset at the end of the month on ${resetLabel}.`,
    };
  }, [textCredits, threshold]);
  const creditsExhausted = Boolean(isAuthenticated && textCredits && textCredits.balance < textCredits.textToMidiCost);

  useEffect(() => () => {
    if (processingTimerRef.current) {
      window.clearInterval(processingTimerRef.current);
    }
  }, []);

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
    if (prompt.trim().length < 3) return toast.error("Describe at least a few notes or a musical feeling.");
    const parsedTempo = Number(tempo);
    if (!Number.isInteger(parsedTempo) || parsedTempo < 40 || parsedTempo > 240) {
      return toast.error("BPM must be a whole number between 40 and 240.");
    }

    if (!isAuthenticated) {
      toast("Sign in to create a project", {
        description: "You can explore the prompt builder first. Login is only required once you want to generate and save.",
      });
      router.push(`/login?next=${encodeURIComponent(projectId ? `/projects/${projectId}` : "/")}`);
      return;
    }

    setBusy(true);
    const generationPrompt = prompt.trim();
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
          kind: kind.toLowerCase().replaceAll(" ", "_") as ComposerSubmitInput["kind"],
          key,
          scale: scale.toLowerCase() as ComposerSubmitInput["scale"],
          tempo: parsedTempo,
        });
        setPrompt("");
        return;
      }

      if (!activeProjectId) {
        const project = await projectsApi.create({
          title: projectTitleFromPrompt(prompt),
          description: prompt.trim(),
          tags: [],
          bpm: parsedTempo,
          musicalKey: `${key} ${scale}`,
        });
        activeProjectId = project.data.id;
      }

      const result = await generateMusic({
          prompt,
          kind: kind.toLowerCase().replaceAll(" ", "_"),
          workflow: "text_to_midi",
          key,
          scale: scale.toLowerCase(),
          tempo: parsedTempo,
          projectId: activeProjectId,
          lengthBars: 8,
          complexity: "medium",
          variationAmount: 0.5,
          timeSignature: [4, 4],
      });
      clearProcessingTimer();
      publishReplyState({
        status: "completed",
        prompt: generationPrompt,
        activeStep: processingSteps.length - 1,
        steps: processingSteps,
        fileName: result.fileName,
        downloadUrl: result.midiFileUrl,
        generationId: result.id,
      });
      toast.success("Your MIDI generation is ready.", { description: "The project now has this idea in its conversation." });
      setPrompt("");
      onGenerated?.();
      void refresh();
      if (!projectId && activeProjectId) router.push(`/projects/${activeProjectId}`);
    } catch (error) {
      clearProcessingTimer();
      publishReplyState(null);
      toast.error(error instanceof Error ? error.message : "Unable to generate MIDI.");
    } finally {
      clearProcessingTimer();
      setBusy(false);
    }
  };

  return (
    <section className={`w-full ${compact ? "" : "mx-auto max-w-[780px]"}`}>
      {usageBanner ? (
        <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${usageBanner.tone}`}>
          <p className="font-semibold">{usageBanner.title}</p>
          <p className="mt-1 text-xs opacity-90">{usageBanner.detail}</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-violet-500/80 bg-[#0e0e1d]/90 p-3 shadow-[0_0_40px_rgba(104,58,255,.10)]">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: Dark trap melody in A minor, piano with bell, emotional vibe"
          aria-label="Music generation prompt"
          className="min-h-28 w-full resize-none bg-transparent px-3 py-4 text-[16px] leading-7 text-white outline-none placeholder:text-[#8f8da3]"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <div className="flex flex-wrap gap-2">
            <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Generation type" className="rounded-xl border border-white/[.06] bg-[#181827] px-3 py-2.5 text-sm text-[#dfdeeb]">
              <option>Melody</option>
              <option>Chords</option>
              <option>Counter Melody</option>
              <option>Bassline</option>
              <option>Drums</option>
              <option>Full Composition</option>
            </select>
            <select value={key} onChange={(event) => setKey(event.target.value)} aria-label="Musical key" className="rounded-xl border border-white/[.06] bg-[#181827] px-3 py-2.5 text-sm text-[#dfdeeb]">
              {keys.map((note) => <option key={note} value={note}>{note}</option>)}
            </select>
            <select value={scale} onChange={(event) => setScale(event.target.value)} aria-label="Major or minor scale" className="rounded-xl border border-white/[.06] bg-[#181827] px-3 py-2.5 text-sm text-[#dfdeeb]">
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
                className="w-12 bg-transparent text-sm text-[#dfdeeb] outline-none"
              />
              <span className="ml-1 text-xs text-[#a8a6b8]">BPM</span>
            </label>
          </div>
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={generate} disabled={busy || creditsExhausted} aria-label="Generate MIDI" className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-[0_0_25px_rgba(119,75,255,.65)] disabled:opacity-60">
            <ArrowUp className="size-5" />
          </motion.button>
        </div>
      </div>
      {localReplyState ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-4 text-sm text-[#ddd9e7]">
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
              <p className="font-medium text-white">Done</p>
              <p className="mt-2 text-[#c2bdd2]">Your MIDI file is ready.</p>
              {localReplyState.downloadUrl && localReplyState.fileName ? (
                <button type="button" onClick={() => downloadFile(localReplyState.downloadUrl!, localReplyState.fileName!)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 font-semibold text-white">
                  <Download className="size-3.5" />
                  {localReplyState.fileName}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {!compact && (
        <>
          <p className="mt-7 text-center text-[15px] text-[#a6a4b5]">Or try something popular</p>
          <div className="mx-auto mt-4 grid max-w-[780px] grid-cols-1 justify-center gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {styles.map(({ prompt: suggestion, detail, icon: Icon }) => (
              <button key={suggestion} onClick={() => setPrompt(suggestion)} className="group rounded-xl border border-white/[.07] bg-[#12121f] p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:bg-[#18172a]">
                <div className="flex items-center gap-3">
                  <Icon className="size-6 shrink-0 text-fuchsia-500" />
                  <span className="text-sm font-semibold leading-4 text-white">{suggestion}</span>
                </div>
                <p className="mt-3 text-xs text-[#9290a3]">{detail}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
