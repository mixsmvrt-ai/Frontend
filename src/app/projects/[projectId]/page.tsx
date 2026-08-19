"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, Bot, Check, CircleDashed, Download, Heart, Loader2, Music2, Pencil, RefreshCcw, Sparkles, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MidiPlayback } from "@/components/midi-playback";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { GenerationComposer, type ComposerReplyState, type ComposerSubmitInput } from "@/features/generation/generation-composer";
import { favoriteGeneration, generateMusic, generationExports, readGeneration, regenerateGeneration, type GenerationFile, type GenerationRecord } from "@/services/generations";
import { projectsApi, type ProjectMessage, type PromptRefinementQuestion } from "@/services/projects";
import { workspaceApi } from "@/services/workspace";

type GenerationMap = Record<string, GenerationRecord>;
type ExportMap = Record<string, GenerationFile[]>;
type PendingMap = Record<string, "download" | "regenerate" | "variation" | "favorite">;

const generationKinds = ["melody", "chords", "chords_and_melody", "counter_melody", "bassline", "drums", "full_composition"] as const;
const producerParts = ["Chords", "Chords + Melody", "Melody", "Lead", "Bass", "808", "Drums"];

const generationProcessingSteps = [
  { title: "Analyzing prompt", detail: "Reading the mood, key, and arrangement cues." },
  { title: "Planning composition", detail: "Shaping the harmony, structure, and rhythm." },
  { title: "Writing MIDI", detail: "Building notes, phrasing, and timing." },
  { title: "Finalizing export", detail: "Preparing the MIDI file for download." },
] as const;

function variationPrompt(prompt: string) {
  return `${prompt}\n\nCreate a fresh variation that keeps the core vibe but changes the melodic phrasing, rhythm accents, and arrangement details.`;
}

function primaryExport(files: GenerationFile[] | undefined) {
  return files?.find((file) => file.kind === "single") ?? files?.[0] ?? null;
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
}

function kindForPart(part: string): ComposerSubmitInput["kind"] {
  if (part === "Chords") return "chords";
  if (part === "Chords + Melody") return "chords_and_melody";
  if (part === "Melody" || part === "Lead") return "melody";
  if (part === "Bass" || part === "808") return "bassline";
  if (part === "Drums") return "drums";
  return "full_composition";
}

function remainingProducerParts(generatedParts: string[]) {
  const completed = new Set(generatedParts);
  if (completed.has("Chords + Melody")) {
    completed.add("Chords");
    completed.add("Melody");
  }
  return producerParts.filter((part) => !completed.has(part));
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useViewerAuth();
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generationMap, setGenerationMap] = useState<GenerationMap>({});
  const [exportMap, setExportMap] = useState<ExportMap>({});
  const [pending, setPending] = useState<PendingMap>({});
  const [composerReply, setComposerReply] = useState<ComposerReplyState | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingBusy, setEditingBusy] = useState(false);
  const [customTempo, setCustomTempo] = useState("");
  const [customTempoActive, setCustomTempoActive] = useState(false);
  const [customMood, setCustomMood] = useState("");
  const [customMoodActive, setCustomMoodActive] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const generationSignalRef = useRef<AbortSignal | undefined>(undefined);
  const initialPromptSubmittedRef = useRef(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    const updateScrollState = () => setShowScrollToBottom(element.scrollHeight - element.scrollTop - element.clientHeight > 80);
    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    return () => element.removeEventListener("scroll", updateScrollState);
  }, [messages.length, composerReply, assistantTyping]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element || loading || !messages.length) return;
    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, messages.length]);

  const scrollToLatest = () => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });

  const loadMessages = useCallback(async () => {
    try {
      const [messagesResult, versionsResult] = await Promise.all([
        projectsApi.messages(projectId),
        workspaceApi.versions(projectId),
      ]);
      setMessages(messagesResult.data);

      const generationIds = Array.from(new Set([
        ...messagesResult.data.map((message) => message.generation_id).filter(Boolean),
        ...versionsResult.data.map((version) => version.generation_id).filter(Boolean),
      ])) as string[];

      if (!generationIds.length) {
        setGenerationMap({});
        return;
      }

      const details = await Promise.all(generationIds.map(async (generationId) => {
        try {
          const generation = await readGeneration(generationId);
          return [generationId, generation] as const;
        } catch {
          return [generationId, null] as const;
        }
      }));

      setGenerationMap(Object.fromEntries(details.filter((entry): entry is readonly [string, GenerationRecord] => Boolean(entry[1]))));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const loadExports = useCallback(async (generationId: string) => {
    if (exportMap[generationId]?.length) {
      return exportMap[generationId];
    }
    setPending((current) => ({ ...current, [generationId]: "download" }));
    try {
      const files = await generationExports(generationId);
      setExportMap((current) => ({ ...current, [generationId]: files }));
      return files;
    } finally {
      setPending((current) => {
        const copy = { ...current };
        delete copy[generationId];
        return copy;
      });
    }
  }, [exportMap]);

  const openExport = async (generationId: string, kind: GenerationFile["kind"] = "single") => {
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }
    try {
      const files = await loadExports(generationId);
      const target = files.find((file) => file.kind === kind) ?? primaryExport(files);
      if (!target) {
        throw new Error("No export file is available for this generation.");
      }
      triggerDownload(target.url, target.fileName);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to open export.");
    }
  };

  const resolvePlaybackUrl = async (generationId: string) => {
    const files = await loadExports(generationId);
    return primaryExport(files)?.url;
  };

  const handleFavorite = async (generationId: string) => {
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }
    setPending((current) => ({ ...current, [generationId]: "favorite" }));
    try {
      await favoriteGeneration(generationId);
      toast.success("Generation added to favorites.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to favorite this generation.");
    } finally {
      setPending((current) => {
        const copy = { ...current };
        delete copy[generationId];
        return copy;
      });
    }
  };

  const handleRegenerate = async (generationId: string) => {
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }
    setPending((current) => ({ ...current, [generationId]: "regenerate" }));
    try {
      await regenerateGeneration(generationId);
      toast.success("Generation retried and added to this project.");
      await loadMessages();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to regenerate this idea.");
    } finally {
      setPending((current) => {
        const copy = { ...current };
        delete copy[generationId];
        return copy;
      });
    }
  };

  const handleVariation = async (generationId: string) => {
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }
    setPending((current) => ({ ...current, [generationId]: "variation" }));
    try {
      const source = generationMap[generationId] ?? await readGeneration(generationId);
      const request = source.generation_requests;
      if (!request) {
        throw new Error("The original generation settings are unavailable.");
      }
      await generateMusic({
        ...(request.settings ?? {}),
        prompt: variationPrompt(request.prompt),
        kind: request.kind,
        projectId,
      } as Parameters<typeof generateMusic>[0]);
      toast.success("Variation created and added to this project.");
      await loadMessages();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to create a variation.");
    } finally {
      setPending((current) => {
        const copy = { ...current };
        delete copy[generationId];
        return copy;
      });
    }
  };

  const messageGenerations = useMemo(() => new Set(messages.map((message) => message.generation_id).filter(Boolean) as string[]), [messages]);

  const beginEditing = (message: ProjectMessage) => {
    setEditingMessageId(message.id);
    setEditingText(message.content);
  };

  const cancelEditing = () => {
    if (editingBusy) return;
    setEditingMessageId(null);
    setEditingText("");
  };

  const submitEditedMessage = async (message: ProjectMessage) => {
    const content = editingText.trim();
    if (content.length < 3 || editingBusy) return;
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }

    const settings = message.generation_id ? generationMap[message.generation_id]?.generation_requests?.settings : undefined;
    const originalSettings = settings as {
      kind?: string;
      key?: string;
      scale?: string;
      tempo?: number;
      lengthBars?: number;
      complexity?: "low" | "medium" | "high";
      variationAmount?: number;
      timeSignature?: [number, number];
    } | undefined;
    const kind = generationKinds.find((value) => value === originalSettings?.kind) ?? "melody";

    setEditingBusy(true);
    setPendingPrompt(content);
    setComposerReply({ status: "processing", prompt: content, activeStep: 0, steps: generationProcessingSteps });
    try {
      await projectsApi.createMessage(projectId, {
        content,
        replaceMessageId: message.id,
        generation: {
          kind,
          key: originalSettings?.key,
          scale: originalSettings?.scale === "major" ? "major" : "minor",
          tempo: originalSettings?.tempo,
          lengthBars: originalSettings?.lengthBars ?? 8,
          complexity: originalSettings?.complexity ?? "medium",
          variationAmount: originalSettings?.variationAmount ?? 0.5,
          timeSignature: originalSettings?.timeSignature ?? [4, 4],
        },
      });
      setEditingMessageId(null);
      setEditingText("");
      await loadMessages();
      setPendingPrompt(null);
      setComposerReply(null);
    } catch (error) {
      setPendingPrompt(null);
      setComposerReply(null);
      toast.error(error instanceof Error ? error.message : "Unable to resubmit this message.");
    } finally {
      setEditingBusy(false);
    }
  };

  const submitProjectPrompt = useCallback(async (input: ComposerSubmitInput) => {
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }

    setPendingPrompt(input.prompt);
    generationSignalRef.current = input.signal;
    setAssistantTyping(false);
    try {
      const refinement = await projectsApi.refine(projectId, { prompt: input.prompt, kind: input.kind }, { signal: input.signal });
      const tempoQuestion: PromptRefinementQuestion = { id: "tempo", label: "Tempo", prompt: "What BPM should I use?", options: ["80 BPM", "95 BPM", "105 BPM", "120 BPM", "Custom BPM"] };
      const questions = [tempoQuestion, ...refinement.data.questions.filter((question) => question.id !== "tempo")];
      if (questions.length) {
        setComposerReply({
          status: "refining",
          prompt: input.prompt,
          activeStep: 0,
          steps: generationProcessingSteps,
          questions,
          refinementIndex: 0,
          refinementAnswers: [],
          kind: input.kind,
          key: input.key,
          scale: input.scale,
          tempo: input.tempo,
          stage: "refinement",
        });
        return;
      }

      setComposerReply({ status: "processing", prompt: input.prompt, activeStep: 0, steps: generationProcessingSteps });
      const result = await projectsApi.createMessage(projectId, {
        content: input.prompt,
        generation: {
          kind: input.kind,
          key: input.key,
          scale: input.scale,
          tempo: input.tempo,
          lengthBars: 8,
          complexity: "medium",
          variationAmount: 0.5,
          timeSignature: [4, 4],
        },
      }, { signal: input.signal });

      if (result.data.mode === "generation") {
        await loadMessages();
        setComposerReply(null);
        setPendingPrompt(null);
        return;
      }

      setComposerReply(null);
      setAssistantTyping(true);
      await new Promise((resolve) => window.setTimeout(resolve, result.data.recommendedDelayMs ?? 2500));
      await loadMessages();
      setPendingPrompt(null);
      setAssistantTyping(false);
    } catch (error) {
      setPendingPrompt(null);
      setAssistantTyping(false);
      setComposerReply(null);
      throw error;
    }
  }, [isAuthenticated, loadMessages, projectId]);

  const answerRefinement = useCallback(async (question: PromptRefinementQuestion, value: string) => {
    if (!composerReply || composerReply.status !== "refining") return;
    if (question.id === "tempo" && value === "Custom BPM") {
      setCustomTempo("");
      setCustomTempoActive(true);
      return;
    }
    if (question.id === "mood" && value === "Custom Mood") {
      setCustomMood("");
      setCustomMoodActive(true);
      return;
    }
    setCustomTempoActive(false);
    setCustomMoodActive(false);
    if (composerReply.stage === "next-part") {
      if (value === "Done") {
        setComposerReply(null);
        return;
      }
      setComposerReply({ ...composerReply, status: "processing" });
      try {
        await projectsApi.createMessage(projectId, {
          content: composerReply.prompt,
          generation: { kind: kindForPart(value), key: composerReply.key, scale: composerReply.scale, tempo: composerReply.tempo, mood: composerReply.refinementAnswers?.find((answer) => answer.category === "mood")?.value, lengthBars: 8, complexity: "medium", variationAmount: 0.5, timeSignature: [4, 4] },
        }, { signal: generationSignalRef.current });
        await loadMessages();
        const generatedParts = [...(composerReply.generatedParts ?? []), value];
        const remaining = remainingProducerParts(generatedParts);
        setComposerReply(remaining.length ? { ...composerReply, status: "refining", stage: "next-part", questions: [{ id: "part", label: "Build next", prompt: "What should I build next?", options: ["Done", ...remaining] }], refinementIndex: 0, refinementAnswers: [], generatedParts } : null);
        return;
      } catch (error) {
        setComposerReply(null);
        throw error;
      }
    }
    const answers = [...(composerReply.refinementAnswers ?? []), { category: question.id, value }];
    const nextIndex = (composerReply.refinementIndex ?? 0) + 1;
    if (nextIndex < (composerReply.questions?.length ?? 0)) {
      setComposerReply({ ...composerReply, refinementIndex: nextIndex, refinementAnswers: answers });
      return;
    }

    setComposerReply({ status: "processing", prompt: composerReply.prompt, activeStep: 0, steps: generationProcessingSteps });
    try {
      const selectedPart = answers.find((answer) => answer.category === "part")?.value;
      const selectedTempo = answers.find((answer) => answer.category === "tempo")?.value.match(/\d+/)?.[0];
      const selectedMood = answers.find((answer) => answer.category === "mood")?.value;
      const generation = await projectsApi.createMessage(projectId, {
        content: composerReply.prompt,
        generation: {
          kind: selectedPart ? kindForPart(selectedPart) : composerReply.kind ?? "full_composition",
          tempo: selectedTempo ? Number(selectedTempo) : composerReply.tempo,
          mood: selectedMood,
          key: composerReply.key,
          scale: composerReply.scale,
          lengthBars: 8,
          complexity: "medium",
          variationAmount: 0.5,
          timeSignature: [4, 4],
        },
      }, { signal: generationSignalRef.current });
      if (generation.data.mode === "generation") await loadMessages();
      const generated = selectedPart ?? (composerReply.kind === "chords" ? "Chords" : composerReply.kind === "drums" ? "Drums" : "Melody");
      setComposerReply({ ...composerReply, status: "refining", stage: "next-part", questions: [{ id: "part", label: "Build next", prompt: "Nice. What should I build next?", options: ["Done", ...remainingProducerParts([generated])] }], refinementIndex: 0, refinementAnswers: [], generatedParts: [generated], tempo: generation.data.generation?.tempo ?? (selectedTempo ? Number(selectedTempo) : composerReply.tempo) });
      setPendingPrompt(null);
    } catch (error) {
      setComposerReply(null);
      setPendingPrompt(null);
      throw error;
    }
  }, [composerReply, loadMessages, projectId]);

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim();
    if (initialPromptSubmittedRef.current || loading || !prompt || messages.length > 0) {
      return;
    }

    const kindParam = searchParams.get("kind");
    const scaleParam = searchParams.get("scale");
    const tempoParam = Number(searchParams.get("tempo"));
    const kind = generationKinds.find((value) => value === kindParam);
    const scale = scaleParam === "major" || scaleParam === "minor" ? scaleParam : undefined;
    const key = searchParams.get("key") || undefined;
    const tempo = Number.isInteger(tempoParam) && tempoParam >= 40 && tempoParam <= 240 ? tempoParam : undefined;

    initialPromptSubmittedRef.current = true;
    router.replace(`/projects/${projectId}`);
    void submitProjectPrompt({
      prompt,
      kind,
      key,
      ...(scale ? { scale } : {}),
      ...(key ? { key } : {}),
      ...(tempo !== undefined ? { tempo } : {}),
    }).catch((error: unknown) => {
      initialPromptSubmittedRef.current = false;
      toast.error(error instanceof Error ? error.message : "Unable to send the first project prompt.");
    });
  }, [loading, messages.length, projectId, router, searchParams, submitProjectPrompt]);

  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col">
        <div ref={messagesRef} className="scrollbar-hidden flex-1 space-y-5 overflow-y-auto px-1 py-5 pb-72 md:px-4 md:py-7 md:pb-56">
          {loading ? <div className="h-20 animate-pulse rounded-2xl bg-white/5" /> : null}
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isGeneration = Boolean(message.generation_id && messageGenerations.has(message.generation_id));
            const actionState = message.generation_id ? pending[message.generation_id] : undefined;
            const exports = message.generation_id ? exportMap[message.generation_id] : undefined;
            const midiTitle = exports?.find((file) => file.kind === "single")?.fileName ?? generationMap[message.generation_id ?? ""]?.generation_files?.[0]?.file_name ?? "MIDI file";
            const generationRequest = message.generation_id ? generationMap[message.generation_id]?.generation_requests : undefined;
            return (
              <article key={message.id} className={`group flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser && <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Bot className="size-4" /></div>}
                <div className={`relative max-w-[84%] rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${isUser ? "bg-violet-600 text-white" : "border border-white/10 bg-white/[.04] text-[#ddd9e7]"}`}>
                  {isUser && editingMessageId === message.id ? (
                    <div className="min-w-[min(24rem,70vw)]">
                      <textarea
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void submitEditedMessage(message);
                        }}
                        disabled={editingBusy}
                        autoFocus
                        className="min-h-20 w-full resize-y rounded-xl border border-white/20 bg-black/15 p-2 text-white outline-none placeholder:text-white/60"
                        aria-label="Edit message"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={cancelEditing} disabled={editingBusy} className="grid size-8 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 disabled:opacity-50" aria-label="Cancel edit"><X className="size-4" /></button>
                        <button type="button" onClick={() => void submitEditedMessage(message)} disabled={editingBusy || editingText.trim().length < 3} className="grid size-8 place-items-center rounded-full bg-white text-violet-700 disabled:opacity-50" aria-label="Resubmit edited message"><Check className="size-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-3">
                      {!isGeneration && <p>{message.content}</p>}
                      {isUser ? (
                        <button type="button" onClick={() => beginEditing(message)} className="shrink-0 text-white/65 transition hover:text-white" aria-label="Edit message">
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  )}
                  {isGeneration ? (
                    <>
                      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white"><MidiPlayback url={primaryExport(exports ?? [])?.url} onRequestUrl={() => resolvePlaybackUrl(message.generation_id!)} prompt={generationRequest?.prompt ?? message.content} kind={generationRequest?.kind} fileName={midiTitle} /><Music2 className="size-4 text-violet-200" />{message.content || midiTitle}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" title="Download MIDI" aria-label="Download MIDI" onClick={() => void openExport(message.generation_id!)} disabled={Boolean(actionState)} className="grid size-9 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/[.08] disabled:opacity-60">{actionState === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}</button>
                        {exports?.some((file) => file.kind === "multi") ? <button type="button" title="Download multi-track MIDI" aria-label="Download multi-track MIDI" onClick={() => void openExport(message.generation_id!, "multi")} disabled={Boolean(actionState)} className="grid size-9 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/[.08] disabled:opacity-60"><Download className="size-4" /></button> : null}
                        {exports?.some((file) => file.kind === "package") ? <button type="button" title="Download ZIP export" aria-label="Download ZIP export" onClick={() => void openExport(message.generation_id!, "package")} disabled={Boolean(actionState)} className="grid size-9 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/[.08] disabled:opacity-60"><Download className="size-4" /></button> : null}
                        <button type="button" title="Retry generation" aria-label="Retry generation" onClick={() => void handleRegenerate(message.generation_id!)} disabled={Boolean(actionState)} className="grid size-9 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/[.08] disabled:opacity-60">{actionState === "regenerate" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}</button>
                        <button type="button" title="Create variation" aria-label="Create variation" onClick={() => void handleVariation(message.generation_id!)} disabled={Boolean(actionState)} className="grid size-9 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/[.08] disabled:opacity-60">{actionState === "variation" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}</button>
                        <button type="button" title="Favorite generation" aria-label="Favorite generation" onClick={() => void handleFavorite(message.generation_id!)} disabled={Boolean(actionState)} className="grid size-9 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/[.08] disabled:opacity-60">{actionState === "favorite" ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}</button>
                      </div>
                    </>
                  ) : null}
                </div>
                {isUser && <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#dcd8e8]"><UserRound className="size-4" /></div>}
              </article>
            );
          })}
          {pendingPrompt ? (
      <article className="flex gap-3 justify-end">
        <div className="max-w-[84%] rounded-2xl bg-violet-600 px-4 py-3 text-sm leading-6 text-white">
        <p>{pendingPrompt}</p>
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#dcd8e8]"><UserRound className="size-4" /></div>
      </article>
      ) : null}
          {composerReply ? (
            <article className="flex gap-3 justify-start">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
                {composerReply.status === "processing" ? <CircleDashed className="size-4 animate-spin" /> : <Bot className="size-4" />}
              </div>
              <div className="max-w-[84%] rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm leading-6 text-[#ddd9e7]">
                {composerReply.status === "processing" ? (
                  <>
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="size-2 animate-pulse rounded-full bg-violet-300" />
                      <span className="size-2 animate-pulse rounded-full bg-violet-300 [animation-delay:150ms]" />
                      <span className="size-2 animate-pulse rounded-full bg-violet-300 [animation-delay:300ms]" />
                    </div>
                  </>
                ) : composerReply.status === "refining" ? (
                  <>
                    <p className="font-medium text-white">{composerReply.questions?.[composerReply.refinementIndex ?? 0]?.prompt}</p>
                    <p className="mt-1 text-xs text-[#a9a4b9]">{composerReply.questions?.[composerReply.refinementIndex ?? 0]?.label} · quick producer check</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {composerReply.questions?.[composerReply.refinementIndex ?? 0]?.options.map((option) => <button key={option} type="button" onClick={() => void answerRefinement(composerReply.questions![composerReply.refinementIndex ?? 0], option)} className="rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:border-violet-300/60 hover:bg-violet-500/20">{option}</button>)}
                    </div>
                    {composerReply.questions?.[composerReply.refinementIndex ?? 0]?.id === "tempo" && customTempoActive ? (
                      <form className="mt-3 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const bpm = Number(customTempo); if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240) { toast.error("BPM must be a whole number between 40 and 240."); return; } void answerRefinement(composerReply.questions![composerReply.refinementIndex ?? 0], `${bpm} BPM`); }}>
                        <input value={customTempo} onChange={(event) => setCustomTempo(event.target.value)} type="number" min="40" max="240" step="1" inputMode="numeric" autoFocus aria-label="Custom BPM" placeholder="40-240" className="w-28 rounded-full border border-violet-300/30 bg-black/20 px-3 py-1.5 text-sm text-white outline-none" />
                        <button type="submit" className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white">Use BPM</button>
                      </form>
                    ) : null}
                    {composerReply.questions?.[composerReply.refinementIndex ?? 0]?.id === "mood" && customMoodActive ? (
                      <form className="mt-3 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const mood = customMood.trim(); if (mood.length < 2 || mood.length > 80) { toast.error("Enter a mood between 2 and 80 characters."); return; } void answerRefinement(composerReply.questions![composerReply.refinementIndex ?? 0], mood); }}>
                        <input value={customMood} onChange={(event) => setCustomMood(event.target.value)} type="text" maxLength={80} autoFocus aria-label="Custom mood" placeholder="Describe the mood" className="min-w-0 flex-1 rounded-full border border-violet-300/30 bg-black/20 px-3 py-1.5 text-sm text-white outline-none" />
                        <button type="submit" className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white">Use Mood</button>
                      </form>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="font-medium text-white">Done</p>
                    <p className="mt-2 text-[#c2bdd2]">Your MIDI file is ready.</p>
                    {composerReply.downloadUrl && composerReply.fileName ? (
                      <button
                        type="button"
                        onClick={() => triggerDownload(composerReply.downloadUrl!, composerReply.fileName!)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 font-semibold text-white"
                      >
                        <Download className="size-3.5" />
                        {composerReply.fileName}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          ) : null}
          {assistantTyping ? (
      <article className="flex gap-3 justify-start">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
        <Bot className="size-4" />
        </div>
        <div className="max-w-[84%] rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm leading-6 text-[#ddd9e7]">
        <p className="font-medium text-white">Music Brain is listening</p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-300 animate-pulse" />
          <span className="size-2 rounded-full bg-violet-300 animate-pulse [animation-delay:150ms]" />
          <span className="size-2 rounded-full bg-violet-300 animate-pulse [animation-delay:300ms]" />
        </div>
        </div>
      </article>
      ) : null}
        </div>

        {showScrollToBottom ? <button type="button" onClick={scrollToLatest} title="Jump to latest message" aria-label="Jump to latest message" className="fixed bottom-44 left-1/2 z-40 grid size-10 -translate-x-1/2 place-items-center rounded-full border border-white/15 bg-[#171427]/95 text-white shadow-[0_12px_35px_rgba(0,0,0,.45)] backdrop-blur transition hover:bg-violet-600 md:bottom-48"><ArrowDown className="size-4" /></button> : null}

        <div className="pb-32">
          <GenerationComposer projectId={projectId} generationActive={composerReply?.status === "processing"} onGenerated={() => void loadMessages()} onReplyStateChange={setComposerReply} onSubmitPrompt={submitProjectPrompt} />
        </div>
      </section>
    </AppShell>
  );
}
