"use client";

import Link from "next/link";
import { Download, Loader2, Music4, RefreshCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useMembership } from "@/features/billing/use-membership";
import { supabase } from "@/lib/supabase/browser";
import { songPacksApi, songPackParts, type SongPackCredits, type SongPackInput, type SongPackListItem, type SongPackPartResult, type SongPackPreviewNote, type SongPackRecord } from "@/services/song-packs";

function formatResetDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function creditsForSelection(count: number, costs: { single: number; small: number; medium: number; large: number }) {
  if (count <= 1) return costs.single;
  if (count <= 3) return costs.small;
  if (count <= 6) return costs.medium;
  return costs.large;
}

function drawPianoRoll(canvas: HTMLCanvasElement, notes: SongPackPreviewNote[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,0.04)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (!notes.length) return;
  const minPitch = Math.min(...notes.map((note) => note.pitch));
  const maxPitch = Math.max(...notes.map((note) => note.pitch));
  const span = Math.max(1, maxPitch - minPitch + 1);
  const maxBeat = Math.max(...notes.map((note) => note.startBeat + note.durationBeats));
  context.strokeStyle = "rgba(255,255,255,0.06)";
  for (let line = 0; line <= 8; line += 1) {
    const y = (line / 8) * canvas.height;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
  context.fillStyle = "rgba(168,85,247,0.85)";
  for (const note of notes) {
    const x = (note.startBeat / Math.max(1, maxBeat)) * canvas.width;
    const width = Math.max(4, (note.durationBeats / Math.max(1, maxBeat)) * canvas.width);
    const y = canvas.height - (((note.pitch - minPitch + 1) / span) * canvas.height);
    context.fillRect(x, y, width, Math.max(5, canvas.height / span));
  }
}

function PartPreview({ part }: { part: SongPackPartResult }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      drawPianoRoll(ref.current, part.previewNotes);
    }
  }, [part.previewNotes]);
  return <canvas ref={ref} width={420} height={120} className="mt-3 h-28 w-full rounded-xl bg-black/20" />;
}

const defaults: SongPackInput = {
  prompt: "",
  genre: "",
  mood: "",
  key: "",
  scale: "",
  energy: "auto",
  complexity: "auto",
  lengthBars: 8,
  selectedParts: ["main_melody", "chord_progression", "bassline", "counter_melody"],
};

export default function SongPackGeneratorPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const { membership } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const [input, setInput] = useState<SongPackInput>(defaults);
  const [credits, setCredits] = useState<SongPackCredits | null>(null);
  const [recentPacks, setRecentPacks] = useState<SongPackListItem[]>([]);
  const [activePack, setActivePack] = useState<SongPackRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  const promptForAuth = () => {
    toast("Sign in to use Song Pack Generator", {
      description: "Login or create an account to generate packs, use credits, and save results.",
    });
    window.location.assign(`/login?next=${encodeURIComponent("/song-pack-generator")}`);
  };

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setCredits(null);
      setRecentPacks([]);
      setLoading(false);
      setError("");
      return;
    }

    try {
      const [creditsResult, packsResult] = await Promise.all([songPacksApi.credits(), songPacksApi.list()]);
      setCredits(creditsResult.data);
      setRecentPacks(packsResult.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Song Pack Generator.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authResolved) return;
    void load();
  }, [authResolved, load]);

  const estimatedCost = useMemo(() => credits ? creditsForSelection(input.selectedParts.length, credits.config.costs) : 0, [credits, input.selectedParts.length]);
  const displayedCredits = credits?.balance ?? 1500;
  const creditResetLabel = credits?.resetsOn ? formatResetDate(credits.resetsOn) : null;

  async function generate() {
    if (!isAuthenticated) {
      promptForAuth();
      return;
    }
    if (!input.prompt.trim()) {
      toast.error("Describe the beat or song pack you want first.");
      return;
    }
    if (!credits) return;
    if (credits.balance < estimatedCost) {
      toast.error(`Not enough credits. ${estimatedCost} required, ${credits.balance} remaining.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...input,
        genre: input.genre?.trim() || undefined,
        mood: input.mood?.trim() || undefined,
        key: input.key?.trim() || undefined,
        scale: input.scale?.trim() || undefined,
      };
      const result = await songPacksApi.create(payload);
      setActivePack(result.data);
      setCredits((current) => current ? { ...current, balance: result.data.creditsRemaining } : current);
      toast.success("Song pack generated.");
      await load();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to generate song pack.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function openPack(packId: string) {
    if (!isAuthenticated) {
      promptForAuth();
      return;
    }
    setBusy(true);
    try {
      const result = await songPacksApi.read(packId);
      setActivePack(result.data);
      setCredits((current) => current ? { ...current, balance: result.data.creditsRemaining } : current);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to load song pack.");
    } finally {
      setBusy(false);
    }
  }

  async function regeneratePart(partId: string) {
    if (!activePack) return;
    if (!isAuthenticated) {
      promptForAuth();
      return;
    }
    setBusy(true);
    try {
      const result = await songPacksApi.regeneratePart(activePack.id, partId);
      setActivePack((current) => current ? { ...current, parts: current.parts.map((part) => part.id === partId ? result.data.part : part), download: result.data.download, creditsRemaining: result.data.creditsRemaining } : current);
      setCredits((current) => current ? { ...current, balance: result.data.creditsRemaining } : current);
      toast.success("Song pack part regenerated.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to regenerate part.");
    } finally {
      setBusy(false);
    }
  }

  async function regeneratePack() {
    if (!activePack) return;
    if (!isAuthenticated) {
      promptForAuth();
      return;
    }
    setBusy(true);
    try {
      const result = await songPacksApi.regeneratePack(activePack.id);
      setActivePack((current) => current ? { ...current, parts: result.data.parts, download: result.data.download, creditsRemaining: result.data.creditsRemaining } : current);
      setCredits((current) => current ? { ...current, balance: result.data.creditsRemaining } : current);
      toast.success("Song pack regenerated.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to regenerate song pack.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-6xl">
        <header className="grid gap-6 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,.22),_transparent_42%),linear-gradient(145deg,_rgba(15,14,29,.96),_rgba(9,8,22,.98))] p-8 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Pro Workspace</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">AI Song Pack Generator</h1>
            <p className="mt-4 max-w-3xl text-[#beb8d1]">Describe the beat you want to build and choose which MIDI parts you want included.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <p className="text-sm font-semibold text-white">Credits</p>
            <p className="mt-4 text-4xl font-black">{displayedCredits}</p>
            <p className="mt-2 text-sm text-[#beb8d1]">{!isAuthenticated ? "Every signed-in account gets 1,500 monthly credits. Song Pack Generator uses 75 credits per generation." : membership?.type === "pro" || membership?.type === "trial" || membership?.type === "admin" ? `Estimated cost for this pack: ${estimatedCost} credits. ${creditResetLabel ? `Credits reset on ${creditResetLabel}.` : ""}` : "Active Pro access is required for Song Pack Generator."}</p>
          </div>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <section className="glass rounded-2xl p-6">
            <label className="block text-sm font-medium">Prompt<textarea value={input.prompt} onChange={(event) => setInput((current) => ({ ...current, prompt: event.target.value }))} rows={1} className="field mt-2 h-12 min-h-12 resize-none rounded-[2rem] px-4 py-3" placeholder="Create a dark Jamaican trap dancehall beat at 100 BPM with emotional piano, deep bass, simple counter melody and no lead." /></label>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="block text-sm font-medium">Genre<input value={input.genre ?? ""} onChange={(event) => setInput((current) => ({ ...current, genre: event.target.value }))} className="field mt-2" placeholder="Auto Detect" /></label>
              <label className="block text-sm font-medium">Mood<input value={input.mood ?? ""} onChange={(event) => setInput((current) => ({ ...current, mood: event.target.value }))} className="field mt-2" placeholder="Auto Detect" /></label>
              <label className="block text-sm font-medium">Tempo<input type="number" min="40" max="240" value={input.tempo ?? ""} onChange={(event) => setInput((current) => ({ ...current, tempo: event.target.value ? Number(event.target.value) : undefined }))} className="field mt-2" placeholder="Auto Detect" /></label>
              <label className="block text-sm font-medium">Key<input value={input.key ?? ""} onChange={(event) => setInput((current) => ({ ...current, key: event.target.value }))} className="field mt-2" placeholder="Auto Detect" /></label>
              <label className="block text-sm font-medium">Scale<input value={input.scale ?? ""} onChange={(event) => setInput((current) => ({ ...current, scale: event.target.value }))} className="field mt-2" placeholder="Auto Detect" /></label>
              <label className="block text-sm font-medium">Energy<select value={input.energy ?? "auto"} onChange={(event) => setInput((current) => ({ ...current, energy: event.target.value as SongPackInput["energy"] }))} className="field mt-2"><option value="auto">Auto Detect</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label className="block text-sm font-medium">Complexity<select value={input.complexity ?? "auto"} onChange={(event) => setInput((current) => ({ ...current, complexity: event.target.value as SongPackInput["complexity"] }))} className="field mt-2"><option value="auto">Auto Detect</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label className="block text-sm font-medium">Swing<input type="number" min="0" max="0.75" step="0.01" value={input.swing ?? ""} onChange={(event) => setInput((current) => ({ ...current, swing: event.target.value ? Number(event.target.value) : undefined }))} className="field mt-2" placeholder="Auto Detect" /></label>
              <label className="block text-sm font-medium">Humanization<input type="number" min="0" max="1" step="0.01" value={input.humanization ?? ""} onChange={(event) => setInput((current) => ({ ...current, humanization: event.target.value ? Number(event.target.value) : undefined }))} className="field mt-2" placeholder="Auto Detect" /></label>
              <label className="block text-sm font-medium">Song length / Bars<input type="number" min="8" max="8" value={input.lengthBars ?? 8} onChange={() => setInput((current) => ({ ...current, lengthBars: 8 }))} className="field mt-2" /></label>
            </div>
            <p className="mt-3 text-xs text-[#8f88a6]">The optimized Song Pack planner currently generates compact 8-bar packs to minimize Gemini token usage.</p>

            <div className="mt-8">
              <p className="text-sm font-semibold text-white">MIDI Part Selector</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {songPackParts.map((part) => {
                  const selected = input.selectedParts.includes(part.key);
                  return (
                    <button key={part.key} type="button" onClick={() => setInput((current) => ({ ...current, selectedParts: selected ? current.selectedParts.filter((value) => value !== part.key) : [...current.selectedParts, part.key] }))} className={`rounded-2xl border px-4 py-3 text-left text-sm ${selected ? "border-violet-400/50 bg-violet-500/10 text-white" : "border-white/10 bg-white/[.03] text-[#c3bdd5]"}`}>
                      {part.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" title="Generate song pack" aria-label="Generate song pack" onClick={() => void generate()} disabled={busy || (isAuthenticated && (loading || !credits?.config.enabled))} className="grid size-11 place-items-center rounded-full bg-violet-600 text-white shadow-[0_0_22px_rgba(139,92,246,.35)] disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}</button>
              <p className="text-sm text-[#aaa3bd]">Song Pack Generator uses {estimatedCost} credits per generation from your 1,500 monthly credits.</p>
            </div>
            {error ? <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
          </section>

          <section className="glass rounded-2xl p-6">
            <p className="text-sm font-semibold text-violet-200">Recent Song Packs</p>
            {loading ? <div className="mt-5 h-32 animate-pulse rounded-2xl bg-white/5" /> : <div className="mt-5 space-y-3">{recentPacks.map((pack) => <button type="button" key={pack.id} onClick={() => void openPack(pack.id)} className="block w-full rounded-2xl border border-white/10 bg-white/[.03] p-4 text-left hover:border-violet-400/40"><p className="font-semibold text-white">{pack.title}</p><p className="mt-2 text-sm text-[#aaa3bd]">{pack.selected_parts.length} parts · {pack.genre ?? "Auto genre"} · {pack.tempo ?? "Auto tempo"}</p><p className="mt-2 text-xs text-[#8f88a6]">{new Date(pack.created_at).toLocaleString()}</p></button>)}{!recentPacks.length ? <p className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-[#aaa3bd]">{isAuthenticated ? "No song packs yet. Your first generation will appear here." : "Sign in to see your saved song packs and available credits."}</p> : null}</div>}
          </section>
        </div>

        {activePack ? (
          <section className="mt-8 glass rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-violet-200">Generated pack</p>
                <h2 className="mt-2 text-3xl font-black text-white">{activePack.title}</h2>
                <p className="mt-2 text-sm text-[#beb8d1]">{activePack.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#d4cfe0]"><span className="rounded-full bg-white/10 px-3 py-1">{activePack.tempo ?? "Auto"} BPM</span><span className="rounded-full bg-white/10 px-3 py-1">{activePack.key ?? "Auto Key"}</span><span className="rounded-full bg-white/10 px-3 py-1">{activePack.scale ?? "Auto Scale"}</span><span className="rounded-full bg-white/10 px-3 py-1">{activePack.creditsUsed} credits used</span></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={activePack.download.url} target="_blank" rel="noreferrer" title="Download entire song pack" aria-label="Download entire song pack" className="grid size-10 place-items-center rounded-full bg-violet-600 text-white"><Download className="size-4" /></a>
                <button type="button" title="Regenerate entire song pack" aria-label="Regenerate entire song pack" onClick={() => void regeneratePack()} disabled={busy} className="grid size-10 place-items-center rounded-full border border-white/10 text-white disabled:opacity-60"><RefreshCcw className="size-4" /></button>
                <Link href={`/projects/${activePack.projectId}`} title="Open project" aria-label="Open project" className="grid size-10 place-items-center rounded-full border border-white/10 text-white"><Music4 className="size-4" /></Link>
              </div>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {activePack.parts.map((part) => (
                <article key={part.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{part.label}</h3>
                      <p className="mt-2 text-sm text-[#b9b3ca]">{part.summary.noteCount} notes · {part.summary.tempo} BPM · {part.summary.key} · {part.summary.scale}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" title={`Download ${part.label}`} aria-label={`Download ${part.label}`} onClick={() => part.url ? window.open(part.url, "_blank", "noopener,noreferrer") : void toast.error("Download is not available for this part yet.")} className="grid size-9 place-items-center rounded-full border border-white/10 text-white"><Download className="size-4" /></button>
                      <button type="button" title={`Regenerate ${part.label}`} aria-label={`Regenerate ${part.label}`} onClick={() => void regeneratePart(part.id)} disabled={busy} className="grid size-9 place-items-center rounded-full border border-white/10 text-white disabled:opacity-60"><RefreshCcw className="size-4" /></button>
                    </div>
                  </div>
                  <PartPreview part={part} />
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}