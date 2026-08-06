"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Bot, CircleDashed, Download, Heart, Loader2, Music2, RefreshCcw, Sparkles, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { GenerationComposer, type ComposerReplyState, type ComposerSubmitInput } from "@/features/generation/generation-composer";
import { favoriteGeneration, generateMusic, generationExports, readGeneration, regenerateGeneration, type GenerationFile, type GenerationRecord } from "@/services/generations";
import { projectsApi, type ProjectMessage } from "@/services/projects";
import { workspaceApi } from "@/services/workspace";

type GenerationMap = Record<string, GenerationRecord>;
type ExportMap = Record<string, GenerationFile[]>;
type PendingMap = Record<string, "download" | "regenerate" | "variation" | "favorite">;

const generationKinds = ["melody", "chords", "counter_melody", "bassline", "drums", "full_composition"] as const;

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
  const initialPromptSubmittedRef = useRef(false);

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

  const submitProjectPrompt = useCallback(async (input: ComposerSubmitInput) => {
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }

    setPendingPrompt(input.prompt);
    setAssistantTyping(false);
    setComposerReply({
      status: "processing",
      prompt: input.prompt,
      activeStep: 0,
      steps: generationProcessingSteps,
    });

    try {
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
      });

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

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim();
    if (initialPromptSubmittedRef.current || loading || !prompt || messages.length > 0) {
      return;
    }

    const kindParam = searchParams.get("kind");
    const scaleParam = searchParams.get("scale");
    const tempoParam = Number(searchParams.get("tempo"));
    const kind = generationKinds.find((value) => value === kindParam) ?? "melody";
    const scale = scaleParam === "major" ? "major" : "minor";
    const key = searchParams.get("key") || "A";
    const tempo = Number.isInteger(tempoParam) && tempoParam >= 40 && tempoParam <= 240 ? tempoParam : 140;

    initialPromptSubmittedRef.current = true;
    router.replace(`/projects/${projectId}`);
    void submitProjectPrompt({
      prompt,
      kind,
      key,
      scale,
      tempo,
    }).catch((error: unknown) => {
      initialPromptSubmittedRef.current = false;
      toast.error(error instanceof Error ? error.message : "Unable to send the first project prompt.");
    });
  }, [loading, messages.length, projectId, router, searchParams, submitProjectPrompt]);

  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col bg-[#090909]">
        <div className="flex-1 space-y-5 overflow-y-auto px-1 py-5 md:px-4 md:py-7">
          {loading ? <div className="h-20 animate-pulse rounded-2xl bg-white/5" /> : null}
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isGeneration = Boolean(message.generation_id && messageGenerations.has(message.generation_id));
            const actionState = message.generation_id ? pending[message.generation_id] : undefined;
            const exports = message.generation_id ? exportMap[message.generation_id] : undefined;
            return (
              <article key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser && <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Bot className="size-4" /></div>}
                <div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-6 ${isUser ? "bg-violet-600 text-white" : "border border-white/10 bg-white/[.04] text-[#ddd9e7]"}`}>
                  <p>{message.content}</p>
                  {isGeneration ? (
                    <>
                      <p className="mt-2 flex items-center gap-1 text-xs text-violet-200"><Music2 className="size-3" /> MIDI added to this project</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <button type="button" onClick={() => void openExport(message.generation_id!)} disabled={Boolean(actionState)} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-white disabled:opacity-60">{actionState === "download" ? "Loading export..." : <span className="inline-flex items-center gap-1"><Download className="size-3.5" />Download MIDI</span>}</button>
                        {exports?.some((file) => file.kind === "multi") ? <button type="button" onClick={() => void openExport(message.generation_id!, "multi")} disabled={Boolean(actionState)} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-white disabled:opacity-60">Multi-track</button> : null}
                        {exports?.some((file) => file.kind === "package") ? <button type="button" onClick={() => void openExport(message.generation_id!, "package")} disabled={Boolean(actionState)} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-white disabled:opacity-60">ZIP export</button> : null}
                        <button type="button" onClick={() => void handleRegenerate(message.generation_id!)} disabled={Boolean(actionState)} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-white disabled:opacity-60">{actionState === "regenerate" ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3.5 animate-spin" />Retrying</span> : <span className="inline-flex items-center gap-1"><RefreshCcw className="size-3.5" />Retry</span>}</button>
                        <button type="button" onClick={() => void handleVariation(message.generation_id!)} disabled={Boolean(actionState)} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-white disabled:opacity-60">{actionState === "variation" ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3.5 animate-spin" />Creating variation</span> : <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5" />Create variation</span>}</button>
                        <button type="button" onClick={() => void handleFavorite(message.generation_id!)} disabled={Boolean(actionState)} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-white disabled:opacity-60">{actionState === "favorite" ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3.5 animate-spin" />Saving</span> : <span className="inline-flex items-center gap-1"><Heart className="size-3.5" />Favorite</span>}</button>
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

        <div className="sticky bottom-0 bg-[#090909]/95 py-5 backdrop-blur">
          <GenerationComposer compact projectId={projectId} onGenerated={() => void loadMessages()} onReplyStateChange={setComposerReply} onSubmitPrompt={submitProjectPrompt} />
        </div>
      </section>
    </AppShell>
  );
}
