"use client";

import Link from "next/link";
import { ArrowUpRight, HardDrive, Mic2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useViewerAuth } from "@/features/auth/use-viewer-auth";
import { useMembership } from "@/features/billing/use-membership";
import { GenerationComposer } from "@/features/generation/generation-composer";
import { dashboardApi, type DashboardOverview } from "@/services/dashboard";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DashboardPage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership, loading: membershipLoading, error: membershipError } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authResolved) return;
    if (!isAuthenticated) {
      setOverview(null);
      setError("");
      return;
    }
    dashboardApi.overview()
      .then((result) => setOverview(result.data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard."));
  }, [authResolved, isAuthenticated]);

  const activeMembership = membership ?? overview?.membership ?? null;
  const progress = useMemo(
    () => activeMembership?.type === "trial"
      ? Math.max(0, Math.min(100, Math.round(((7 - activeMembership.daysRemaining) / 7) * 100)))
      : activeMembership?.type === "pro" && activeMembership.price?.days
        ? Math.max(0, Math.min(100, Math.round(((activeMembership.price.days - activeMembership.daysRemaining) / activeMembership.price.days) * 100)))
        : activeMembership?.type === "expired"
          ? 100
          : 0,
    [activeMembership],
  );

  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col justify-center">
        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Main Workspace</p>
          <h1 className="mt-4 text-5xl font-black leading-[1.04] tracking-[-.05em] sm:text-6xl">
            Describe the <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">music</span>
            <br />
            in <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">your</span> head.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#b2acc2]">Tell MidiFlow what you want to create. Your first prompt generates the result and saves it into a project conversation automatically.</p>
        </header>

        <div className="mt-10">
          <GenerationComposer />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link href="/voice-to-midi" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-[#d7d2e2] transition hover:bg-white/[.05]">
            <Mic2 className="size-4 text-violet-300" />
            Open Voice to MIDI
          </Link>
          <Link href={activeMembership?.type === "pro" || activeMembership?.type === "admin" ? "/renew" : "/upgrade"} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 font-semibold text-white">
            <Sparkles className="size-4" />
            {activeMembership?.type === "trial" ? `${activeMembership.daysRemaining} trial days left` : activeMembership?.type === "pro" ? "Renew Pro Pass" : activeMembership?.type === "expired" ? "Restore generation access" : "Manage access"}
          </Link>
        </div>
      </section>

      {error ? <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
      {!isAuthenticated ? <p className="mt-6 rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm text-[#c9c4d7]">You can explore the workspace layout as a guest. Sign in when you want project history, downloads, and personal stats.</p> : null}

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent projects</h2>
            <Link href="/projects" className="text-sm text-violet-300">View all</Link>
          </div>
          <div className="mt-6 space-y-3">
            {overview ? overview.recentProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 transition hover:border-violet-400/40">
                <div>
                  <p className="font-medium">{project.title}</p>
                  <p className="text-xs text-[#9e98b0]">Updated {new Date(project.updated_at).toLocaleDateString()}</p>
                </div>
                <ArrowUpRight className="size-4 text-[#aaa4b9]" />
              </Link>
            )) : <div className="h-32 animate-pulse rounded-2xl bg-white/5" />}
            {overview && !overview.recentProjects.length ? <p className="text-sm text-[#aaa3bd]">No projects yet. Your first prompt will create one automatically.</p> : !isAuthenticated ? <p className="text-sm text-[#aaa3bd]">Sign in to see your recent projects here.</p> : null}
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold">Plan and usage</h2>
          {membershipLoading && !activeMembership ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-white/5" /> : membershipError ? <p className="mt-5 text-sm text-red-200">{membershipError}</p> : <><p className="mt-5 text-3xl font-bold capitalize">{!isAuthenticated ? "Guest" : activeMembership?.type === "expired" ? "Read-only" : activeMembership?.type ?? "Trial"}</p><p className="mt-1 text-sm text-[#a4a0b2]">{!isAuthenticated ? "Sign in to unlock personal usage, saved projects, and billing status." : activeMembership?.type === "trial" ? `${activeMembership.daysRemaining} days left in your 7-day Pro trial` : activeMembership?.type === "pro" ? `${activeMembership.daysRemaining} days left in your Pro Pass` : activeMembership?.type === "admin" ? "Administrative access stays active" : "Upgrade to restore generation and project creation"}</p></>}
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }} /></div>
          <dl className="mt-6 grid gap-3 text-sm text-[#c9c4d7]"><div className="flex items-center justify-between rounded-xl bg-white/[.03] px-4 py-3"><dt>Projects</dt><dd>{overview?.stats.totalProjects ?? 0}</dd></div><div className="flex items-center justify-between rounded-xl bg-white/[.03] px-4 py-3"><dt>Generations</dt><dd>{overview?.stats.totalGenerations ?? 0}</dd></div><div className="flex items-center justify-between rounded-xl bg-white/[.03] px-4 py-3"><dt>Downloads</dt><dd>{overview?.stats.totalDownloads ?? 0}</dd></div><div className="flex items-center justify-between rounded-xl bg-white/[.03] px-4 py-3"><dt className="flex items-center gap-2"><HardDrive className="size-4 text-violet-300" />Storage</dt><dd>{formatBytes(overview?.stats.storageBytes ?? 0)}</dd></div></dl>
          <Link href={activeMembership?.type === "pro" || activeMembership?.type === "admin" ? "/renew" : "/upgrade"} className="mt-6 inline-block text-sm font-semibold text-violet-300">{activeMembership?.type === "pro" || activeMembership?.type === "admin" ? "Renew Pro Pass" : "Upgrade to Pro Pass"}</Link>
        </section>
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Recent generations</h2><Link href="/history" className="text-sm text-violet-300">See history</Link></div>
          <div className="mt-6 space-y-3">{overview ? overview.recentGenerations.map((generation) => <div key={generation.id} className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3"><p className="font-medium">{generation.generation_requests?.prompt ?? "Generation request"}</p><p className="mt-1 text-xs uppercase tracking-[.16em] text-violet-300">{generation.generation_requests?.kind ?? generation.status}</p><p className="mt-2 text-xs text-[#9e98b0]">{new Date(generation.created_at).toLocaleString()}</p></div>) : <div className="h-32 animate-pulse rounded-2xl bg-white/5" />}{overview && !overview.recentGenerations.length ? <p className="text-sm text-[#aaa3bd]">No generations yet. Start with text or voice.</p> : !isAuthenticated ? <p className="text-sm text-[#aaa3bd]">Sign in to see your generation history here.</p> : null}</div>
        </section>

        <section className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Link href="/downloads" className="text-sm text-violet-300">Exports</Link></div>
          <div className="mt-6 space-y-3">{overview ? overview.recentActivity.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3"><p className="font-medium capitalize">{item.action} {item.entity_type}</p><p className="mt-1 text-xs text-[#9e98b0]">{new Date(item.created_at).toLocaleString()}</p></div>) : <div className="h-32 animate-pulse rounded-2xl bg-white/5" />}{overview && !overview.recentActivity.length ? <p className="text-sm text-[#aaa3bd]">Your latest activity will appear here.</p> : !isAuthenticated ? <p className="text-sm text-[#aaa3bd]">Sign in to unlock activity, exports, and saved workspace changes.</p> : null}</div>
        </section>
      </div>
    </AppShell>
  );
}
