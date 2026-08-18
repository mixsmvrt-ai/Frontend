"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, AudioLines, Copy, Download, Ellipsis, LogOut, Menu, Mic2, Package2, Plus, Search, Settings, Shield, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { SettingsSheet, SubscriptionDialog } from "@/components/settings-sheet";
import { TrialWelcomeModal } from "@/components/trial-welcome-modal";
import { useMembership } from "@/features/billing/use-membership";
import { supabase } from "@/lib/supabase/browser";
import { projectsApi } from "@/services/projects";

type Project = { id: string; title: string; updated_at: string };

export const bottomLinks = [
  { label: "Downloads", href: "/download", icon: Download },
  { label: "Pricing", href: "/pricing", icon: Sparkles },
  { label: "Settings", href: "/settings", icon: Settings },
];

type WorkspaceMenuProps = {
  isAuthenticated: boolean;
  membership: ReturnType<typeof useMembership>["membership"];
  pricingHref: string;
  showAdminLink: boolean;
  showPlanPricing: boolean;
  workspaceLinks: typeof bottomLinks;
  isBottomActive: (href: string) => boolean;
  onNavigate: () => void;
};

function sidebarLinkClass(active: boolean) {
  return active
    ? "flex items-center gap-3 rounded-xl bg-[#a7e2d9] px-3 py-2.5 text-sm font-semibold text-[#12151a]"
    : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#aeb3bd] transition hover:bg-white/[.05] hover:text-white";
}

export function WorkspaceMenu({
  isAuthenticated,
  membership,
  pricingHref,
  showAdminLink,
  showPlanPricing,
  workspaceLinks,
  isBottomActive,
  onNavigate,
}: WorkspaceMenuProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121021]/95 p-4 shadow-[0_24px_80px_rgba(4,4,12,0.55)] backdrop-blur">
      <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#817d91]">Workspace</p>
      <div className="space-y-1">
        {workspaceLinks.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={label === "Pricing" ? pricingHref : href} onClick={onNavigate} className={sidebarLinkClass(isBottomActive(label === "Pricing" ? pricingHref : href))}>
            <Icon className="size-4 text-violet-200" />
            {label}
          </Link>
        ))}
        {showAdminLink ? (
          <Link href="/admin" onClick={onNavigate} className={sidebarLinkClass(isBottomActive("/admin"))}>
            <Shield className="size-4 text-violet-200" />
            Admin panel
          </Link>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
        {isAuthenticated ? (
          <>
            <Link href="/profile" onClick={onNavigate} className="flex items-center gap-3 text-sm font-semibold text-white">
              <span className="grid size-9 place-items-center rounded-full bg-white/10"><UserRound className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">Account</span>
                <span className="mt-0.5 block text-xs text-[#9d97b0]">{showPlanPricing ? "Open profile to view your membership and account details." : membership?.type === "trial" ? `${membership.daysRemaining} trial days left` : membership?.type === "pro" ? `${membership.daysRemaining} Pro days left` : membership?.type === "expired" ? "Read-only access" : "Workspace settings"}</span>
              </span>
            </Link>
            <div className="mt-3 flex gap-2">
              <Link href="/profile" onClick={onNavigate} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-semibold text-[#d7d2e2]">Profile</Link>
              <Link href="/logout" onClick={onNavigate} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#d7d2e2]"><LogOut className="size-3.5" />Logout</Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm font-semibold text-white">
              <span className="grid size-9 place-items-center rounded-full bg-white/10"><UserRound className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">Account</span>
                <span className="mt-0.5 block text-xs text-[#9d97b0]">Sign in when you&apos;re ready to save projects and generate MIDI.</span>
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link href="/login?next=%2Fcreate" onClick={onNavigate} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-semibold text-[#d7d2e2]">Log in</Link>
              <Link href="/signup?next=%2Fcreate" onClick={onNavigate} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-semibold text-[#d7d2e2]">Sign up</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [trialWelcomeOpen, setTrialWelcomeOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const desktopWorkspaceMenuRef = useRef<HTMLDivElement>(null);
  const projectSearchRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressProjectClickRef = useRef(false);
  const { membership } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });

  useEffect(() => {
    if (!supabase) {
      setAuthResolved(true);
      setIsAuthenticated(false);
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

  const loadProjects = useCallback(async () => {
    if (!isAuthenticated) {
      setProjects([]);
      return;
    }

    try {
      const result = await projectsApi.list("", "updated_at");
      setProjects(result.data as Project[]);
    } catch {
      setProjects([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authResolved) return;
    void loadProjects();
  }, [authResolved, loadProjects]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuId(null);
      if (!workspaceMenuRef.current?.contains(event.target as Node) && !desktopWorkspaceMenuRef.current?.contains(event.target as Node)) setWorkspaceMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const clearProjectLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startProjectLongPress = (projectId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    clearProjectLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      suppressProjectClickRef.current = true;
      setMenuId(projectId);
      longPressTimerRef.current = null;
    }, 500);
  };

  useEffect(() => {
    if (!mobileOpen) {
      setWorkspaceMenuOpen(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (projectSearchOpen) projectSearchRef.current?.focus();
  }, [projectSearchOpen]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("midiflow:show-trial-welcome") === "1") setTrialWelcomeOpen(true);
  }, []);

  const closeTrialWelcome = () => {
    window.localStorage.removeItem("midiflow:show-trial-welcome");
    setTrialWelcomeOpen(false);
  };

  const projectAction = async (action: "rename" | "duplicate" | "archive" | "delete", project: Project) => {
    try {
      if (action === "rename") {
        const title = window.prompt("Project name", project.title)?.trim();
        if (!title || title === project.title) return;
        await projectsApi.update(project.id, { title });
        toast.success("Project renamed.");
      }

      if (action === "duplicate") {
        const duplicate = await projectsApi.duplicate(project.id);
        toast.success("Project duplicated.");
        router.push(`/projects/${duplicate.data.id}`);
      }

      if (action === "archive") {
        await projectsApi.update(project.id, { archived: true });
        toast.success("Project archived.");
      }

      if (action === "delete") {
        if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
        await projectsApi.remove(project.id);
        toast.success("Project deleted.");
      }

      setMenuId(null);
      await loadProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the project.");
    }
  };

  const projectList = projectQuery.trim()
    ? projects.filter((project) => project.title.toLowerCase().includes(projectQuery.trim().toLowerCase()))
    : projects;

  const showAdminLink = Boolean(isAuthenticated && membership?.isAdmin);
  const sidebar = (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-xl font-black tracking-tight" onClick={() => setMobileOpen(false)}>
          <AudioLines className="size-6 text-fuchsia-500" />
          <span>MidiFlow</span>
        </Link>
        <div className="flex items-center gap-2">
          {projectSearchOpen ? (
            <label className="flex h-11 w-[min(190px,52vw)] items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 text-white focus-within:border-violet-400/70">
              <Search className="size-4 shrink-0 text-[#9b97a9]" />
              <input ref={projectSearchRef} value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#898595]" placeholder="Search projects" aria-label="Search projects" />
              <button type="button" onClick={() => { setProjectQuery(""); setProjectSearchOpen(false); }} className="grid size-6 shrink-0 place-items-center rounded-full text-[#aaa6b7] hover:bg-white/10 hover:text-white" aria-label="Close project search">
                <X className="size-3.5" />
              </button>
            </label>
          ) : (
            <button type="button" onClick={() => setProjectSearchOpen(true)} className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white transition hover:bg-white/[.08]" aria-label="Search projects">
              <Search className="size-5" />
            </button>
          )}
          <button type="button" onClick={() => setMobileOpen(false)} className="grid size-11 place-items-center rounded-full bg-white/5 text-[#cfc9dd] md:hidden" aria-label="Close sidebar">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="space-y-2">
          <Link href="/" onClick={() => setMobileOpen(false)} className={sidebarLinkClass(pathname === "/" || pathname === "/dashboard")}>
            <Plus className="size-4 text-violet-200" />
            New Chat
          </Link>
          <Link href="/voice-to-midi" onClick={() => setMobileOpen(false)} className={sidebarLinkClass(pathname === "/voice-to-midi")}>
            <Mic2 className="size-4 text-violet-200" />
            Voice to MIDI
          </Link>
          <Link href="/song-pack-generator" onClick={() => setMobileOpen(false)} className={sidebarLinkClass(pathname === "/song-pack-generator")}>
            <Package2 className="size-4 text-violet-200" />
            Song Pack Generator
          </Link>
        </div>
      </div>

      <div className="mx-3 border-t border-white/10" />

      <div ref={menuRef} className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#817d91]">Projects</p>
          <Link href="/projects" onClick={() => setMobileOpen(false)} className="text-xs font-semibold text-violet-300">Open all</Link>
        </div>

        <div className="space-y-1">
          {projectList.map((project) => (
            <div key={project.id} onPointerDown={(event) => startProjectLongPress(project.id, event)} onPointerUp={clearProjectLongPress} onPointerCancel={clearProjectLongPress} onPointerLeave={clearProjectLongPress} onContextMenu={(event) => event.preventDefault()} className="group relative flex items-center rounded-xl pr-1 hover:bg-white/[.055]">
              <Link href={`/projects/${project.id}`} onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { if (suppressProjectClickRef.current) { event.preventDefault(); suppressProjectClickRef.current = false; return; } setMobileOpen(false); }} className={`min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-sm transition ${pathname === `/projects/${project.id}` ? "bg-white/[.07] text-white" : "text-[#c8c4d3] group-hover:text-white"}`}>
                {project.title}
              </Link>
              <button
                type="button"
                onClick={() => setMenuId(menuId === project.id ? null : project.id)}
                aria-label={`Project options for ${project.title}`}
                className="invisible grid size-8 place-items-center rounded-md text-[#a6a0b4] hover:bg-white/10 hover:text-white group-hover:visible focus:visible"
              >
                <Ellipsis className="size-4" />
              </button>
              {menuId === project.id && (
                <div className="absolute right-1 top-9 z-50 w-[min(10rem,calc(100vw-2rem))] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#1a1828] p-1 shadow-2xl">
                  <button type="button" onClick={() => void projectAction("rename", project)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"><Ellipsis className="size-3.5" />Rename</button>
                  <button type="button" onClick={() => void projectAction("duplicate", project)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"><Copy className="size-3.5" />Duplicate</button>
                  <button type="button" onClick={() => void projectAction("archive", project)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"><Archive className="size-3.5" />Archive</button>
                  <button type="button" onClick={() => void projectAction("delete", project)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"><Trash2 className="size-3.5" />Delete</button>
                </div>
              )}
            </div>
          ))}
          {!projectList.length && <p className="px-3 py-4 text-sm leading-5 text-[#888397]">Your musical projects will appear here.</p>}
        </div>
      </div>

      <div ref={workspaceMenuRef} className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 md:hidden">
        <div className={`pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4 transition duration-200 ${workspaceMenuOpen ? "opacity-100" : "opacity-0"}`}>
          <div className={`${workspaceMenuOpen ? "pointer-events-auto" : "pointer-events-none"} max-h-[calc(100dvh-2rem)] w-[min(360px,calc(100vw-2rem))] origin-center overflow-y-auto transition duration-200 ${workspaceMenuOpen ? "translate-y-0 scale-100" : "translate-y-2 scale-95"}`}>
          <SettingsSheet
            isAuthenticated={isAuthenticated}
            membership={membership}
            showAdminLink={showAdminLink}
            onSubscription={() => setSubscriptionOpen(true)}
            onNavigate={() => {
              setWorkspaceMenuOpen(false);
              setMobileOpen(false);
            }}
          />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Link href="/" onClick={() => setMobileOpen(false)} className="pointer-events-auto grid size-12 place-items-center rounded-full bg-violet-600 text-white shadow-[0_18px_40px_rgba(91,33,182,0.38)] transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-300/70" aria-label="New text to MIDI chat">
            <Plus className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
            aria-label="Open workspace menu"
            aria-expanded={workspaceMenuOpen}
            className="pointer-events-auto grid size-12 place-items-center rounded-full border border-white/10 bg-[#171427] text-[#d7d2e2] shadow-[0_18px_40px_rgba(6,6,14,0.45)] transition hover:scale-[1.02] hover:bg-[#1d1a31] focus:outline-none focus:ring-2 focus:ring-violet-400/70"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-black text-white md:flex">
      <button type="button" onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-50 grid size-11 place-items-center rounded-full border border-white/10 bg-black/75 text-white shadow-[0_12px_32px_rgba(0,0,0,.35)] backdrop-blur transition hover:bg-white/[.12] md:hidden" aria-label="Open sidebar">
          <Menu className="size-5" />
      </button>

      {mobileOpen ? <button type="button" className="fixed inset-0 z-40 bg-black/60 md:hidden" aria-label="Close sidebar overlay" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[290px] shrink-0 flex-col border-r border-white/10 bg-black transition-transform md:sticky md:top-0 md:z-20 md:h-screen md:w-80 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        {sidebar}

        <div ref={desktopWorkspaceMenuRef} className="absolute bottom-4 left-4 right-4 hidden md:block">
          <div className={`pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4 transition duration-200 ${workspaceMenuOpen ? "opacity-100" : "opacity-0"}`}>
            <div className={`${workspaceMenuOpen ? "pointer-events-auto" : "pointer-events-none"} max-h-[calc(100dvh-2rem)] w-[min(400px,calc(100vw-2rem))] origin-center overflow-y-auto transition duration-200 ${workspaceMenuOpen ? "translate-y-0 scale-100" : "translate-y-2 scale-95"}`}>
            <SettingsSheet
              isAuthenticated={isAuthenticated}
              membership={membership}
              showAdminLink={showAdminLink}
              onSubscription={() => setSubscriptionOpen(true)}
              onNavigate={() => {
                setWorkspaceMenuOpen(false);
                setMobileOpen(false);
              }}
            />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link href="/" onClick={() => setMobileOpen(false)} className="grid size-12 place-items-center rounded-full bg-violet-600 text-white shadow-[0_18px_40px_rgba(91,33,182,0.38)] transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-300/70" aria-label="New text to MIDI chat">
              <Plus className="size-5" />
            </Link>
            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen((open) => !open)}
              aria-label="Open workspace menu"
              aria-expanded={workspaceMenuOpen}
              className="grid size-12 place-items-center rounded-full border border-white/10 bg-[#171427] text-[#d7d2e2] shadow-[0_18px_40px_rgba(6,6,14,0.45)] transition hover:scale-[1.02] hover:bg-[#1d1a31] focus:outline-none focus:ring-2 focus:ring-violet-400/70"
            >
              <Settings className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      {subscriptionOpen ? <SubscriptionDialog membership={membership} onClose={() => setSubscriptionOpen(false)} /> : null}
      {trialWelcomeOpen ? <TrialWelcomeModal onClose={closeTrialWelcome} onStart={closeTrialWelcome} /> : null}

      <main className="min-w-0 flex-1 overflow-x-hidden md:h-[100dvh] md:overflow-y-auto">
        <div className="p-5 md:p-8">{children}</div>
      </main>
    </div>
  );
}
