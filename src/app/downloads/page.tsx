"use client";

import { Download, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { dashboardApi, type DashboardDownload } from "@/services/dashboard";

export default function DownloadsPage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const [downloads, setDownloads] = useState<DashboardDownload[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!authResolved) return;
    if (!isAuthenticated) {
      setDownloads([]);
      setError("");
      setLoading(false);
      return;
    }
    dashboardApi.downloads()
      .then((result) => setDownloads(result.data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load downloads."))
      .finally(() => setLoading(false));
  }, [authResolved, isAuthenticated]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return downloads;
    return downloads.filter((item) =>
      [item.file_name, item.projects?.title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [downloads, query]);

  const handleDownload = async (downloadId: string) => {
    if (!isAuthenticated) {
      promptSignIn("/downloads");
      return;
    }
    try {
      const result = await dashboardApi.downloadUrl(downloadId);
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to start download.");
    }
  };

  const handleDelete = async (downloadId: string) => {
    if (!isAuthenticated) {
      promptSignIn("/downloads");
      return;
    }
    try {
      await dashboardApi.deleteDownload(downloadId);
      setDownloads((current) => current.filter((item) => item.id !== downloadId));
      toast.success("Download removed from your library.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to remove download.");
    }
  };

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Download center</p>
          <h1 className="mt-2 text-4xl font-black">Your exported MIDI files.</h1>
          <p className="mt-3 max-w-2xl text-sm text-[#aaa3bd]">Search, open, and remove delivered exports without leaving your workspace.</p>
        </div>
      </header>

      <label className="relative mt-8 block max-w-xl">
        <Search className="absolute left-3 top-3.5 size-4 text-[#8f8a9d]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="field pl-10" placeholder="Search downloads" />
      </label>

      {error ? <p className="mt-8 text-red-200">{error}</p> : null}
      {loading ? (
        <div className="mt-8 grid gap-4">
          {Array.from({ length: 5 }, (_, index) => <div className="h-20 animate-pulse rounded-2xl bg-white/5" key={index} />)}
        </div>
      ) : !isAuthenticated ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6 text-sm text-[#aaa3bd]">
          Browse the download center layout before signing in. Your exported MIDI files, project-linked downloads, and delete actions will appear here once you log in.
        </div>
      ) : (
        <div className="data-scroll data-scroll-x mt-8 rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/5 text-[#aaa3bd]">
              <tr>
                <th className="p-4">File</th>
                <th className="p-4">Project</th>
                <th className="p-4">Date</th>
                <th className="p-4">Size</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((file) => (
                <tr className="border-t border-white/10" key={file.id}>
                  <td className="p-4 font-medium"><div>{file.file_name}</div>{file.metadata?.includedParts?.length ? <div className="mt-2 flex flex-wrap gap-1">{file.metadata.includedParts.slice(0, 4).map((part) => <span key={part} className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-[#cfc8dd]">{part}</span>)}</div> : null}</td>
                  <td className="p-4 text-[#aaa3bd]">{file.projects?.title ?? "Unassigned"}</td>
                  <td className="p-4 text-[#aaa3bd]">{new Date(file.generated_at).toLocaleDateString()}</td>
                  <td className="p-4 text-[#aaa3bd]">{Math.ceil(file.file_size_bytes / 1024)} KB</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void handleDownload(file.id)} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold">
                        <Download className="size-3.5" />
                        Download
                      </button>
                      <button type="button" onClick={() => void handleDelete(file.id)} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200">
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="p-6 text-sm text-[#aaa3bd]">No downloadable MIDI files match this search.</p> : null}
        </div>
      )}
    </AppShell>
  );
}
