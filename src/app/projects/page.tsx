"use client";

import { Archive, Copy, FolderPlus, RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { projectsApi, type ProjectRecord } from "@/services/projects";

export default function ProjectsPage() {
  const { isAuthenticated } = useViewerAuth();
  const [items, setItems] = useState<ProjectRecord[]>([]);
  const [trashed, setTrashed] = useState<ProjectRecord[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated_at" | "created_at">("updated_at");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"active" | "trash">("active");

  useEffect(() => {
    setLoading(true);
    Promise.all([projectsApi.list(query, sort), projectsApi.trashed()])
      .then(([active, removed]) => {
        setItems(active.data);
        setTrashed(removed.data);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load projects."))
      .finally(() => setLoading(false));
  }, [query, sort]);

  const visible = useMemo(() => (view === "active" ? items : trashed), [items, trashed, view]);

  const removeProject = async (project: ProjectRecord) => {
    if (!isAuthenticated) {
      promptSignIn("/projects");
      return;
    }
    try {
      await projectsApi.remove(project.id);
      setItems((current) => current.filter((item) => item.id !== project.id));
      setTrashed((current) => [{ ...project, deleted_at: new Date().toISOString() }, ...current]);
      toast.success("Project moved to trash.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to remove project.");
    }
  };

  const restoreProject = async (projectId: string) => {
    if (!isAuthenticated) {
      promptSignIn("/projects");
      return;
    }
    try {
      const result = await projectsApi.restore(projectId);
      setTrashed((current) => current.filter((item) => item.id !== projectId));
      setItems((current) => [result.data, ...current]);
      toast.success("Project restored.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to restore project.");
    }
  };

  const duplicateProject = async (projectId: string) => {
    if (!isAuthenticated) {
      promptSignIn("/projects");
      return;
    }
    try {
      const result = await projectsApi.duplicate(projectId);
      window.location.assign(`/projects/${result.data.id}`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to duplicate project.");
    }
  };

  const archiveProject = async (projectId: string) => {
    if (!isAuthenticated) {
      promptSignIn("/projects");
      return;
    }
    try {
      await projectsApi.update(projectId, { archived: true });
      setItems((current) => current.filter((item) => item.id !== projectId));
      toast.success("Project archived.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to archive project.");
    }
  };

  return (
    <AppShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Projects</p>
          <h1 className="mt-2 text-4xl font-black">Your ideas, organized.</h1>
          <p className="mt-3 max-w-2xl text-sm text-[#aaa3bd]">Search, sort, duplicate, archive, and restore projects from one place.</p>
        </div>
        <Link href="/" className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold"><FolderPlus className="size-4" />New project</Link>
      </header>

      <div className="mt-8 flex flex-wrap gap-3">
        <label className="relative block min-w-0 w-full max-w-xl flex-1 sm:min-w-[260px]">
          <Search className="absolute left-3 top-3.5 size-4 text-[#8f8a9d]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="field pl-10" placeholder="Search projects" />
        </label>
        <select value={sort} onChange={(event) => setSort(event.target.value as "updated_at" | "created_at")} className="field max-w-[180px]">
          <option value="updated_at">Recently updated</option>
          <option value="created_at">Newest first</option>
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView("active")} className={`rounded-xl px-4 py-3 text-sm font-semibold ${view === "active" ? "bg-violet-600 text-white" : "border border-white/10 text-[#c9c4d7]"}`}>Active</button>
          <button type="button" onClick={() => setView("trash")} className={`rounded-xl px-4 py-3 text-sm font-semibold ${view === "trash" ? "bg-violet-600 text-white" : "border border-white/10 text-[#c9c4d7]"}`}>Trash</button>
        </div>
      </div>

      {error ? <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
      {loading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div className="h-48 animate-pulse rounded-2xl bg-white/5" key={index} />)}</div> : visible.length ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((project) => <article className="glass rounded-2xl p-5" key={project.id}><Link className="block transition hover:text-violet-200" href={`/projects/${project.id}`}><p className="text-lg font-bold">{project.title}</p><p className="mt-2 line-clamp-2 text-sm text-[#a4a0b2]">{project.description || "No description provided."}</p></Link><div className="mt-4 flex flex-wrap gap-2">{project.project_tags?.slice(0, 3).map((tag) => <span key={tag.tag} className="rounded-full bg-white/8 px-3 py-1 text-xs text-[#d5d1e3]">{tag.tag}</span>)}</div><p className="mt-5 text-xs text-[#8e899b]">Updated {new Date(project.updated_at).toLocaleDateString()}</p><div className="mt-5 flex flex-wrap gap-2">{view === "active" ? <><button type="button" onClick={() => void duplicateProject(project.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><Copy className="size-3.5" />Duplicate</button><button type="button" onClick={() => void archiveProject(project.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><Archive className="size-3.5" />Archive</button><button type="button" onClick={() => void removeProject(project)} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200"><Trash2 className="size-3.5" />Trash</button></> : <button type="button" onClick={() => void restoreProject(project.id)} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold"><RotateCcw className="size-3.5" />Restore</button>}</div></article>)}</div> : <p className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6 text-sm text-[#aaa3bd]">{view === "active" ? "No projects match this search yet." : "Your trash is empty."}</p>}
    </AppShell>
  );
}
