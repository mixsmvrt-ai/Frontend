"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type GenreProfileRecord = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  tempo_min: number;
  tempo_max: number;
  default_tempo: number;
  primary_scales: string[];
  secondary_scales: string[];
  common_time_signatures: string[];
  common_instruments: string[];
  melody_density: string;
  rhythm_complexity: string;
  common_intervals: string[];
  typical_note_lengths: string[];
  swing_amount: number;
  bass_style: string;
  chord_complexity: string;
  velocity_range: number[];
  humanization_amount: number;
  energy: string;
  brightness: string;
  aggressiveness: string;
  groove: string;
  mood: string[];
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

const blankProfile: GenreProfileRecord = {
  name: "",
  slug: "",
  description: "",
  tempo_min: 90,
  tempo_max: 120,
  default_tempo: 100,
  primary_scales: [],
  secondary_scales: [],
  common_time_signatures: ["4/4"],
  common_instruments: [],
  melody_density: "medium",
  rhythm_complexity: "medium",
  common_intervals: [],
  typical_note_lengths: [],
  swing_amount: 0,
  bass_style: "",
  chord_complexity: "medium",
  velocity_range: [72, 112],
  humanization_amount: 0.35,
  energy: "medium",
  brightness: "balanced",
  aggressiveness: "balanced",
  groove: "steady",
  mood: [],
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

export default function GenreProfilesAdminPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<GenreProfileRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<GenreProfileRecord>(blankProfile);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const authUserId = await getUserId();
    if (!authUserId) {
      router.replace("/login?next=%2Fadmin%2FgenreProfiles");
      return;
    }
    setUserId(authUserId);
    const response = await fetch(`${apiBase}/admin/genreProfiles`, { headers: { "x-user-id": authUserId }, credentials: "include" });
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

  function openEdit(row: GenreProfileRecord) {
    setEditingId(row.id ?? null);
    setEditor({ ...row });
  }

  async function save() {
    if (!editor.name.trim()) {
      toast.error("Genre name is required.");
      return;
    }
    const payload = {
      ...editor,
      slug: editor.slug.trim() || slugify(editor.name),
      default_tempo: Number(editor.default_tempo),
      tempo_min: Number(editor.tempo_min),
      tempo_max: Number(editor.tempo_max),
      swing_amount: Number(editor.swing_amount),
      humanization_amount: Number(editor.humanization_amount),
      velocity_range: [Number(editor.velocity_range[0] ?? 72), Number(editor.velocity_range[1] ?? 112)],
    };
    setSaving(true);
    try {
      const response = await fetch(`${apiBase}${editingId ? `/admin/genreProfiles/${editingId}` : "/admin/genreProfiles"}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save genre profile.");
      toast.success(editingId ? "Genre profile updated." : "Genre profile created.");
      await load();
      openNew();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to save genre profile.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    const response = await fetch(`${apiBase}/admin/genreProfiles/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-user-id": userId },
      credentials: "include",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Unable to delete genre profile.");
      return;
    }
    toast.success("Genre profile deleted.");
    await load();
  }

  async function toggleActive(row: GenreProfileRecord) {
    if (!row.id) return;
    const response = await fetch(`${apiBase}/admin/genreProfiles/${encodeURIComponent(row.id)}`, {
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
    toast.success(row.active ? "Genre disabled." : "Genre enabled.");
    await load();
  }

  async function duplicate(row: GenreProfileRecord) {
    const clone = {
      ...row,
      name: `${row.name} Copy`,
      slug: `${row.slug}-copy-${Date.now().toString().slice(-4)}`,
      active: false,
    };
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;
    const response = await fetch(`${apiBase}/admin/genreProfiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      credentials: "include",
      body: JSON.stringify(clone),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Unable to duplicate genre profile.");
      return;
    }
    toast.success("Genre profile duplicated.");
    await load();
  }

  async function importProfiles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as GenreProfileRecord[];
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of genre profiles.");
      setSaving(true);
      for (const row of parsed) {
        const payload = { ...blankProfile, ...row, slug: row.slug || slugify(row.name) };
        const endpoint = row.id ? `/admin/genreProfiles/${row.id}` : "/admin/genreProfiles";
        const method = row.id ? "PATCH" : "POST";
        const response = await fetch(`${apiBase}${endpoint}`, {
          method,
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? `Unable to import ${row.name}.`);
      }
      toast.success("Genre profiles imported.");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to import genre profiles.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-black p-5 text-white md:p-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link href="/admin" className="font-black text-violet-200">MidiFlow</Link>
        <span className="rounded-full bg-fuchsia-400/15 px-3 py-1 text-xs font-bold text-fuchsia-200">GENRE PROFILES</span>
      </header>

      <section className="mx-auto mt-8 max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Knowledge</p>
            <h1 className="mt-2 text-3xl font-black">Genre Management</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#aaa3bd]">Create, edit, duplicate, enable, disable, import, and export Music Brain genre profiles without changing code.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold"><Plus className="size-4" />New genre</button>
            <button type="button" onClick={() => exportJson("genre-profiles.json", filtered)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold"><Download className="size-4" />Export</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold"><Upload className="size-4" />Import</button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importProfiles(event)} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section>
            <div className="flex flex-wrap gap-3">
              <label className="relative block min-w-0 w-full flex-1 sm:min-w-[260px]">
                <Search className="absolute right-3 top-3.5 size-4 text-[#938e9f]" />
                <input className="field pr-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search genre profiles" />
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
                  <article key={row.id ?? row.slug} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold text-white">{row.name}</h2>
                          <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[.16em] ${row.active ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-[#cbc6d8]"}`}>{row.active ? "Active" : "Inactive"}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#918aa6]">{row.slug}</p>
                        <p className="mt-3 max-w-2xl text-sm text-[#cfc9dc]">{row.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold">Edit</button>
                        <button type="button" onClick={() => void duplicate(row)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><Copy className="size-3.5" />Duplicate</button>
                        <button type="button" onClick={() => void toggleActive(row)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><Check className="size-3.5" />{row.active ? "Disable" : "Enable"}</button>
                        {row.id ? <button type="button" onClick={() => void remove(row.id!, row.name)} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200"><Trash2 className="size-3.5" />Delete</button> : null}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-[#bfb9d0] md:grid-cols-3">
                      <p>Tempo: {row.tempo_min}-{row.tempo_max} BPM</p>
                      <p>Default: {row.default_tempo} BPM</p>
                      <p>Groove: {row.groove}</p>
                    </div>
                  </article>
                ))}
                {!filtered.length ? <p className="rounded-2xl border border-white/10 bg-white/[.03] p-6 text-sm text-[#aaa3bd]">No genre profiles match this filter.</p> : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-violet-400/30 bg-violet-500/[.05] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{editingId ? "Edit genre profile" : "Create genre profile"}</h2>
              <button type="button" onClick={openNew} className="grid size-8 place-items-center rounded-lg bg-white/10"><X className="size-4" /></button>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="block text-sm font-medium">Name<input value={editor.name} onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} className="field mt-2" /></label>
              <label className="block text-sm font-medium">Slug<input value={editor.slug} onChange={(event) => setEditor((current) => ({ ...current, slug: slugify(event.target.value) }))} className="field mt-2" /></label>
              <label className="block text-sm font-medium">Description<textarea value={editor.description} onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))} className="field mt-2 min-h-24" /></label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium">Tempo min<input type="number" value={editor.tempo_min} onChange={(event) => setEditor((current) => ({ ...current, tempo_min: Number(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Tempo max<input type="number" value={editor.tempo_max} onChange={(event) => setEditor((current) => ({ ...current, tempo_max: Number(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Default tempo<input type="number" value={editor.default_tempo} onChange={(event) => setEditor((current) => ({ ...current, default_tempo: Number(event.target.value) }))} className="field mt-2" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Primary scales<input value={tagsValue(editor.primary_scales)} onChange={(event) => setEditor((current) => ({ ...current, primary_scales: parseTags(event.target.value) }))} className="field mt-2" placeholder="Natural Minor, Pentatonic Minor" /></label>
                <label className="block text-sm font-medium">Secondary scales<input value={tagsValue(editor.secondary_scales)} onChange={(event) => setEditor((current) => ({ ...current, secondary_scales: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Time signatures<input value={tagsValue(editor.common_time_signatures)} onChange={(event) => setEditor((current) => ({ ...current, common_time_signatures: parseTags(event.target.value) }))} className="field mt-2" placeholder="4/4, 6/8" /></label>
                <label className="block text-sm font-medium">Common instruments<input value={tagsValue(editor.common_instruments)} onChange={(event) => setEditor((current) => ({ ...current, common_instruments: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Moods<input value={tagsValue(editor.mood)} onChange={(event) => setEditor((current) => ({ ...current, mood: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Common intervals<input value={tagsValue(editor.common_intervals)} onChange={(event) => setEditor((current) => ({ ...current, common_intervals: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Typical note lengths<input value={tagsValue(editor.typical_note_lengths)} onChange={(event) => setEditor((current) => ({ ...current, typical_note_lengths: parseTags(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Bass style<input value={editor.bass_style} onChange={(event) => setEditor((current) => ({ ...current, bass_style: event.target.value }))} className="field mt-2" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Melody density<input value={editor.melody_density} onChange={(event) => setEditor((current) => ({ ...current, melody_density: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Rhythm complexity<input value={editor.rhythm_complexity} onChange={(event) => setEditor((current) => ({ ...current, rhythm_complexity: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Chord complexity<input value={editor.chord_complexity} onChange={(event) => setEditor((current) => ({ ...current, chord_complexity: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Groove<input value={editor.groove} onChange={(event) => setEditor((current) => ({ ...current, groove: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Energy<input value={editor.energy} onChange={(event) => setEditor((current) => ({ ...current, energy: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Brightness<input value={editor.brightness} onChange={(event) => setEditor((current) => ({ ...current, brightness: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Aggressiveness<input value={editor.aggressiveness} onChange={(event) => setEditor((current) => ({ ...current, aggressiveness: event.target.value }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Swing amount<input type="number" min="0" max="1" step="0.01" value={editor.swing_amount} onChange={(event) => setEditor((current) => ({ ...current, swing_amount: Number(event.target.value) }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Humanization amount<input type="number" min="0" max="1" step="0.01" value={editor.humanization_amount} onChange={(event) => setEditor((current) => ({ ...current, humanization_amount: Number(event.target.value) }))} className="field mt-2" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Velocity min<input type="number" min="1" max="127" value={editor.velocity_range[0] ?? 72} onChange={(event) => setEditor((current) => ({ ...current, velocity_range: [Number(event.target.value), current.velocity_range[1] ?? 112] }))} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Velocity max<input type="number" min="1" max="127" value={editor.velocity_range[1] ?? 112} onChange={(event) => setEditor((current) => ({ ...current, velocity_range: [current.velocity_range[0] ?? 72, Number(event.target.value)] }))} className="field mt-2" /></label>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm font-medium">
                <input type="checkbox" checked={editor.active} onChange={(event) => setEditor((current) => ({ ...current, active: event.target.checked }))} />
                Active in Music Brain detection and recommendations
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