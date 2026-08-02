"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, CircleDashed, Download, Heart, Loader2, Music2, RefreshCcw, Save, Sparkles, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { GenerationComposer, type ComposerReplyState } from "@/features/generation/generation-composer";
import { favoriteGeneration, generateMusic, generationExports, readGeneration, regenerateGeneration, type GenerationFile, type GenerationRecord } from "@/services/generations";
import { projectsApi, type ProjectMessage, type ProjectRecord } from "@/services/projects";
import { workspaceApi } from "@/services/workspace";

type GenerationMap = Record<string, GenerationRecord>;
type ExportMap = Record<string, GenerationFile[]>;
type PendingMap = Record<string, "download" | "regenerate" | "variation" | "favorite">;

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
  const { isAuthenticated } = useViewerAuth();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [notes, setNotes] = useState("");
  const [versionCount, setVersionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generationMap, setGenerationMap] = useState<GenerationMap>({});
  const [exportMap, setExportMap] = useState<ExportMap>({});
  const [pending, setPending] = useState<PendingMap>({});
  const [composerReply, setComposerReply] = useState<ComposerReplyState | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const [projectResult, messagesResult, notesResult, versionsResult] = await Promise.all([
        projectsApi.read(projectId),
        projectsApi.messages(projectId),
        workspaceApi.notes(projectId),
        workspaceApi.versions(projectId),
      ]);
      setProject(projectResult.data);
      setMessages(messagesResult.data);
      setNotes(notesResult.data?.content_markdown ?? "");
      setVersionCount(versionsResult.data.length);

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

  const saveNotes = async () => {
    if (!isAuthenticated) {
      promptSignIn(`/projects/${projectId}`);
      return;
    }
    try {
      await workspaceApi.saveNotes(projectId, notes);
      toast.success("Project notes saved.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to save notes.");
    }
  };

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

  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-5xl flex-col">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Project conversation</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{project?.title ?? "Keep every iteration in the same musical world."}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#aaa3bd]">
            {project?.description || "Every new direction uses the project's previous prompts and generated MIDI as context. Ask for a variation, swap an instrument, or develop the arrangement."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#9e98b0]">
            <span className="rounded-full bg-white/5 px-3 py-1">{project?.genre ?? "No genre set"}</span>
            <span className="rounded-full bg-white/5 px-3 py-1">{project?.bpm ? `${project.bpm} BPM` : "Tempo flexible"}</span>
            <span className="rounded-full bg-white/5 px-3 py-1">{project?.musical_key ?? "Key open"}</span>
            <span className="rounded-full bg-white/5 px-3 py-1">{versionCount} saved versions</span>
            <Link href="/downloads" className="rounded-full bg-white/5 px-3 py-1 text-violet-200">Open downloads</Link>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Project notes</h2>
            <button type="button" onClick={() => void saveNotes()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold">
              <Save className="size-3.5" />
              Save notes
            </button>
          </div>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-4 min-h-32 w-full rounded-xl border border-white/10 bg-[#0c0b18] p-4 text-sm text-white outline-none" placeholder="Keep arrangement ideas, plugin notes, and revision goals here." />
        </section>

        <div className="flex-1 space-y-5 py-7">
          {loading ? <div className="h-20 animate-pulse rounded-2xl bg-white/5" /> : null}
          {!loading && messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-violet-400/35 bg-violet-500/[.04] p-6 text-sm leading-6 text-[#c7c3d3]">
              Start this project with a musical idea. Follow-ups such as &quot;make it a darker sustained piano&quot; will remain connected to what you create first.
            </div>
          ) : null}
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
          {composerReply ? (
            <article className="flex gap-3 justify-start">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
                {composerReply.status === "processing" ? <CircleDashed className="size-4 animate-spin" /> : <Bot className="size-4" />}
              </div>
              <div className="max-w-[84%] rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm leading-6 text-[#ddd9e7]">
                {composerReply.status === "processing" ? (
                  <>
                    <p className="font-medium text-white">Working on your MIDI reply</p>
                    <div className="mt-4 space-y-3">
                      {composerReply.steps.map((step, index) => {
                        const isDone = index < composerReply.activeStep;
                        const isActive = index === composerReply.activeStep;
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
        </div>

        <div className="sticky bottom-0 bg-[#090816]/95 py-5 backdrop-blur">
          <GenerationComposer compact projectId={projectId} onGenerated={() => void loadMessages()} onReplyStateChange={setComposerReply} />
        </div>
      </section>
    </AppShell>
  );
}
