"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Gauge, Music, Search, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { knowledgeApi, type KnowledgeGenre, type KnowledgeSearchResult } from "@/services/knowledge";

const examples = ["best key for dark trap", "best BPM for Afrobeats", "recommended instruments for LoFi", "best scale for emotional piano", "suitable plugins for House"];

export default function KnowledgePage() {
  const [genres, setGenres] = useState<KnowledgeGenre[]>([]);
  const [query, setQuery] = useState("best key for dark trap");
  const [result, setResult] = useState<KnowledgeSearchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeApi.genres().then(({ data }) => setGenres(data)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load knowledge.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!query.trim()) return;
      knowledgeApi.search(query).then(({ data }) => setResult(data)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to search knowledge."));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const featured = useMemo(() => genres.slice(0, 8), [genres]);

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Music Knowledge Engine</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Search the musical brain behind every generation.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#aaa3bd]">Browse genre, mood, key, scale, tempo, instrument, plugin, and structure recommendations without waiting for an AI call.</p>
        </div>
      </header>

      <label className="relative mt-8 block max-w-2xl">
        <Search className="absolute left-3 top-3.5 size-4 text-[#918c9e]" />
        <input className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask: best chord progression for Drill" />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example) => <button key={example} onClick={() => setQuery(example)} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-[#c9c4d4] hover:bg-white/10">{example}</button>)}
      </div>

      {error ? <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}

      {result ? (
        <section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <article className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-violet-300" />
              <h2 className="font-semibold">Recommendation snapshot</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {result.genres.slice(0, 3).map((genre) => (
                <div key={genre.name} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                  <p className="font-semibold">{genre.name}</p>
                  <p className="mt-2 text-xs leading-5 text-[#aaa3bd]">{genre.description}</p>
                  <p className="mt-3 text-xs text-violet-200">{genre.defaultBpm} BPM · {genre.tonalityPreference} · {genre.energyLevel}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <Gauge className="size-5 text-violet-300" />
              <h2 className="font-semibold">Theory picks</h2>
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <p><span className="text-[#aaa3bd]">Keys:</span> {result.recommendations?.[0]?.keys?.map((item) => item.name).slice(0, 4).join(", ") || result.moods[0]?.suggestedKeys?.join(", ") || "No match"}</p>
              <p><span className="text-[#aaa3bd]">Scales:</span> {result.scales.slice(0, 4).map((item) => item.name).join(", ") || result.moods[0]?.suggestedScales?.join(", ") || "No match"}</p>
              <p><span className="text-[#aaa3bd]">Chords:</span> {result.chords.slice(0, 3).map((item) => item.romanNumerals.join("-")).join(", ") || "No match"}</p>
            </div>
          </article>

          <article className="glass rounded-2xl p-6 xl:col-span-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-violet-300" />
              <h2 className="font-semibold">Production categories</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {result.instruments.slice(0, 4).map((instrument) => <div key={instrument.name} className="rounded-xl bg-white/[.04] p-4"><p className="text-sm font-semibold">{instrument.name}</p><p className="mt-1 text-xs text-[#aaa3bd]">{instrument.category}</p></div>)}
              {result.plugins.slice(0, 4).map((plugin) => <div key={plugin.category} className="rounded-xl bg-white/[.04] p-4"><p className="text-sm font-semibold">{plugin.category}</p><p className="mt-1 text-xs leading-5 text-[#aaa3bd]">{plugin.description}</p></div>)}
            </div>
          </article>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="size-5 text-violet-300" />Genre database</h2>
        {loading ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div className="h-44 animate-pulse rounded-2xl bg-white/5" key={index} />)}</div> : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((genre) => (
              <article key={genre.name} className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
                <Music className="size-5 text-violet-300" />
                <h3 className="mt-5 font-semibold">{genre.name}</h3>
                <p className="mt-2 text-xs leading-5 text-[#aaa3bd]">{genre.bpmRange[0]}-{genre.bpmRange[1]} BPM · {genre.defaultBpm} default</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#c9c4d4]">{genre.instrumentRecommendations.join(", ")}</p>
                <p className="mt-4 flex items-center gap-1 text-xs text-violet-200"><WandSparkles className="size-3" />{genre.pluginCategories.slice(0, 2).join(", ")}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
