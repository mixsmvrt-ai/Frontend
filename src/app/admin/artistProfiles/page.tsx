"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type ArtistProfileRecord = {
  id?: string;
  artist_name: string;
  profile_slug: string;
  aliases: string[];
  region: string;
  primary_genre: string;
  secondary_genre: string;
  primary_genres: string[];
  knowledge_genres: string[];
  tempo_min: number;
  tempo_max: number;
  default_tempo: number;
  energy_level: string;
  mood_tags: string[];
  instrument_tags: string[];
  key_preferences: string[];
  scale_preferences: string[];
  instrument_preferences: string[];
  melody_density: string;
  groove_style: string;
  melody_style: string;
  rhythm_style: string;
  production_style: string;
  chord_style: string;
  arrangement_tendencies: string[];
  production_traits: string[];
  plugin_categories: string[];
  description: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

const blankProfile: ArtistProfileRecord = {
  artist_name: "",
  profile_slug: "",
  aliases: [],
  region: "",
  primary_genre: "",
  secondary_genre: "",
  primary_genres: [],
  knowledge_genres: [],
  tempo_min: 90,
  tempo_max: 110,
  default_tempo: 100,
  energy_level: "Medium",
  mood_tags: [],
  instrument_tags: [],
  key_preferences: [],
  scale_preferences: [],
  instrument_preferences: [],
  melody_density: "Medium",
  groove_style: "Balanced",
  melody_style: "",
  rhythm_style: "",
  production_style: "",
  chord_style: "",
  arrangement_tendencies: [],
  production_traits: [],
  plugin_categories: [],
  description: "",
  active: true,
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseTags(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function tagsValue(value: string[]) {
  return value.join(", ");
}

function exportJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function getUserId() {
  const result = await supabase?.auth.getUser();
  return result?.data.user?.id ?? null;
}

export default function ArtistProfilesAdminPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<ArtistProfileRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<ArtistProfileRecord>(blankProfile);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const authUserId = await getUserId();
    if (!authUserId) {
      router.replace("/login?next=%2Fadmin%2FartistProfiles");
      return;
    }
    setUserId(authUserId);
    const response = await fetch(`${apiBase}/admin/artistProfiles`, { headers: { "x-user-id": authUserId }, credentials: "include" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Administrator access required.");
      setLoading(false);
      return;
    }
    setRows(body.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter === "active" && !row.active) return false;
    if (filter === "inactive" && row.active) return false;
    if (!query.trim()) return true;
    const needle = query.toLowerCase();
    return JSON.stringify(row).toLowerCase().includes(needle);
  }), [filter, query, rows]);

  function openNew() {
    setEditingId(null);
    setEditor(blankProfile);
  }

  function openEdit(row: ArtistProfileRecord) {
    setEditingId(row.id ?? null);
    setEditor({ ...row });
  }

  async function save() {
    if (!editor.artist_name.trim()) {
      toast.error("Artist name is required.");
      return;
    }
    const primaryGenres = editor.primary_genres.length ? editor.primary_genres : parseTags(`${editor.primary_genre}, ${editor.secondary_genre}`);
    const payload = {
      ...editor,
      profile_slug: editor.profile_slug.trim() || slugify(editor.artist_name),
      primary_genre: editor.primary_genre.trim() || primaryGenres[0] || editor.artist_name,
      secondary_genre: editor.secondary_genre.trim() || primaryGenres[1] || null,
      primary_genres: primaryGenres,
      tempo_min: Number(editor.tempo_min),
      tempo_max: Number(editor.tempo_max),
      default_tempo: Number(editor.default_tempo),
    };
    setSaving(true);
    try {
      const response = await fetch(`${apiBase}${editingId ? `/admin/artistProfiles/${editingId}` : "/admin/artistProfiles"}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save artist profile.");
      toast.success(editingId ? "Artist profile updated." : "Artist profile created.");
      await load();
      openNew();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to save artist profile.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    const response = await fetch(`${apiBase}/admin/artistProfiles/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-user-id": userId },
      credentials: "include",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Unable to delete artist profile.");
      return;
    }
    toast.success("Artist profile deleted.");
    await load();
  }

  async function toggleActive(row: ArtistProfileRecord) {
    if (!row.id) return;
    const response = await fetch(`${apiBase}/admin/artistProfiles/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      credentials: "include",
      body: JSON.stringify({ active: !row.active }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Unable to update status.");
      return;
    }
    toast.success(row.active ? "Artist disabled." : "Artist enabled.");
    await load();
  }

  async function duplicate(row: ArtistProfileRecord) {
    const clone = {
      ...row,
      artist_name: `${row.artist_name} Copy`,
      profile_slug: `${row.profile_slug}-copy-${Date.now().toString().slice(-4)}`,
      active: false,
    };
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;
    const response = await fetch(`${apiBase}/admin/artistProfiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      credentials: "include",
      body: JSON.stringify(clone),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Unable to duplicate artist profile.");
      return;
    }
    toast.success("Artist profile duplicated.");
    await load();
  }

  async function importProfiles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ArtistProfileRecord[];
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of artist profiles.");
      setSaving(true);
      for (const row of parsed) {
        const payload = { ...blankProfile, ...row, profile_slug: row.profile_slug || slugify(row.artist_name) };
        const endpoint = row.id ? `/admin/artistProfiles/${row.id}` : "/admin/artistProfiles";
        const method = row.id ? "PATCH" : "POST";
        const response = await fetch(`${apiBase}${endpoint}`, {
          method,
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? `Unable to import ${row.artist_name}.`);
      }
      toast.success("Artist profiles imported.");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to import artist profiles.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-black p-5 text-white md:p-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link href="/admin/music-brain" className="font-black text-violet-200">MidiFlow</Link>
        <span className="rounded-full bg-fuchsia-400/15 px-3 py-1 text-xs font-bold text-fuchsia-200">ARTIST PROFILES</span>
      </header>

      <section className="mx-auto mt-8 max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Music Brain</p>
            <h1 className="mt-2 text-3xl font-black">Artist Knowledge Engine</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#aaa3bd]">Add, edit, disable, import, export, and search artist vibe profiles without changing code. These profiles drive artist-inspired but original MIDI planning.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold"><Plus className="size-4" />New artist</button>
            <button type="button" onClick={() => exportJson("artist-profiles.json", filtered)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold"><Download className="size-4" />Export</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold"><Upload className="size-4" />Import</button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importProfiles(event)} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section>
            <div className="flex flex-wrap gap-3">
              <label className="relative block min-w-0 w-full flex-1 sm:min-w-[260px]">
                <Search className="absolute right-3 top-3.5 size-4 text-[#938e9f]" />
                <input className="field pr-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artist profiles" />
              </label>
              <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | "active" | "inactive")} className="field max-w-[180px]">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {error ? <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
            {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-white/5" /> : (
              <div className="mt-6 grid gap-4">
                {filtered.map((row) => (
                  <article key={row.id ?? row.profile_slug} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold text-white">{row.artist_name}</h2>
                          <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[.16em] ${row.active ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-[#cbc6d8]"}`}>{row.active ? "Active" : "Inactive"}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#918aa6]">{row.profile_slug} · {row.region}</p>
                        <p className="mt-3 max-w-2xl text-sm text-[#cfc9dc]">{row.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold">Edit</button>
                        <button type="button" onClick={() => void duplicate(row)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><Copy className="size-3.5" />Duplicate</button>
                        <button type="button" onClick={() => void toggleActive(row)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><Check className="size-3.5" />{row.active ? "Disable" : "Enable"}</button>
                        {row.id ? <button type="button" onClick={() => void remove(row.id!, row.artist_name)} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200"><Trash2 className="size-3.5" />Delete</button> : null}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-[#bfb9d0] md:grid-cols-3">
                      <p>Genres: {row.primary_genres.join(", ") || row.primary_genre}</p>
                      <p>Tempo: {row.tempo_min}-{row.tempo_max} BPM</p>
                      <p>Energy: {row.energy_level}</p>
                    </div>
                    <div className="mt-2 grid gap-3 text-sm text-[#bfb9d0] md:grid-cols-2">
                      <p>Instruments: {row.instrument_preferences.join(", ") || row.instrument_tags.join(", ")}</p>
                      <p>Plugin categories: {row.plugin_categories.join(", ")}</p>
                    </div>
                  </article>
                ))}
                {!filtered.length ? <p className="rounded-2xl border border-white/10 bg-white/[.03] p-6 text-sm text-[#aaa3bd]">No artist profiles match this filter.</p> : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-violet-400/30 bg-violet-500/[.05] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{editingId ? "Edit artist profile" : "Create artist profile"}</h2>
              <button type="button" onClick={openNew} className="grid size-8 place-items-center rounded-lg bg-white/10"><X className="size-4" /></button>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="block text-sm font-medium">Artist name<input value={editor.artist_name} onChange={(event) => setEditor((current) => ({ ...current, artist_name: event.target.value, profile_slug: current.profile_slug || slugify(event.target.value) }))} className="field mt-2" /></label>
              <label className="block text-sm font-medium">Slug<input value={editor.profile_slug} onChange={(event) => setEditor((current) => ({ ...current, profile_slug: slugify(event.target.value) }))} className="field mt-2" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Region<input value={editor.region} onChange={(event) => setEditor((current) => ({ ...current, region: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Energy<input value={editor.energy_level} onChange={(event) => setEditor((current) => ({ ...current, energy_level: event.target.value }))} className="field mt-2" /></label>
              </div>
              <label className="block text-sm font-medium">Description<textarea value={editor.description} onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))} className="field mt-2 min-h-24" /></label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium">Tempo min<input type="number" value={editor.tempo_min} onChange={(event) => setEditor((current) => ({ ...current, tempo_min: Number(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Tempo max<input type="number" value={editor.tempo_max} onChange={(event) => setEditor((current) => ({ ...current, tempo_max: Number(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Default tempo<input type="number" value={editor.default_tempo} onChange={(event) => setEditor((current) => ({ ...current, default_tempo: Number(event.target.value) }))} className="field mt-2" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Aliases<input value={tagsValue(editor.aliases)} onChange={(event) => setEditor((current) => ({ ...current, aliases: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Primary genres<input value={tagsValue(editor.primary_genres)} onChange={(event) => setEditor((current) => ({ ...current, primary_genres: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Knowledge genres<input value={tagsValue(editor.knowledge_genres)} onChange={(event) => setEditor((current) => ({ ...current, knowledge_genres: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Mood traits<input value={tagsValue(editor.mood_tags)} onChange={(event) => setEditor((current) => ({ ...current, mood_tags: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Key preferences<input value={tagsValue(editor.key_preferences)} onChange={(event) => setEditor((current) => ({ ...current, key_preferences: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Scale preferences<input value={tagsValue(editor.scale_preferences)} onChange={(event) => setEditor((current) => ({ ...current, scale_preferences: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Instrument preferences<input value={tagsValue(editor.instrument_preferences)} onChange={(event) => setEditor((current) => ({ ...current, instrument_preferences: parseTags(event.target.value), instrument_tags: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Plugin categories<input value={tagsValue(editor.plugin_categories)} onChange={(event) => setEditor((current) => ({ ...current, plugin_categories: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Arrangement tendencies<input value={tagsValue(editor.arrangement_tendencies)} onChange={(event) => setEditor((current) => ({ ...current, arrangement_tendencies: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Production traits<input value={tagsValue(editor.production_traits)} onChange={(event) => setEditor((current) => ({ ...current, production_traits: parseTags(event.target.value) }))} className="field mt-2" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Primary genre label<input value={editor.primary_genre} onChange={(event) => setEditor((current) => ({ ...current, primary_genre: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Secondary genre label<input value={editor.secondary_genre} onChange={(event) => setEditor((current) => ({ ...current, secondary_genre: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Melody density<input value={editor.melody_density} onChange={(event) => setEditor((current) => ({ ...current, melody_density: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Groove style<input value={editor.groove_style} onChange={(event) => setEditor((current) => ({ ...current, groove_style: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Melody style<textarea value={editor.melody_style} onChange={(event) => setEditor((current) => ({ ...current, melody_style: event.target.value }))} className="field mt-2 min-h-20" /></label>
                <label className="block text-sm font-medium">Rhythm style<textarea value={editor.rhythm_style} onChange={(event) => setEditor((current) => ({ ...current, rhythm_style: event.target.value }))} className="field mt-2 min-h-20" /></label>
                <label className="block text-sm font-medium">Production style<textarea value={editor.production_style} onChange={(event) => setEditor((current) => ({ ...current, production_style: event.target.value }))} className="field mt-2 min-h-20" /></label>
                <label className="block text-sm font-medium">Chord style<textarea value={editor.chord_style} onChange={(event) => setEditor((current) => ({ ...current, chord_style: event.target.value }))} className="field mt-2 min-h-20" /></label>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm font-medium">
                <input type="checkbox" checked={editor.active} onChange={(event) => setEditor((current) => ({ ...current, active: event.target.checked }))} />
                Active in Music Brain artist detection and vibe recommendations
              </label>
              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {saving ? "Saving" : editingId ? "Save changes" : "Create profile"}
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}