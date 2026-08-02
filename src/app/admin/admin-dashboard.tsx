"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bot,
  Check,
  Clock3,
  CreditCard,
  Database,
  FileText,
  FolderKanban,
  Headset,
  LayoutDashboard,
  Loader2,
  Menu,
  Music2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  Wallet,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type ResourceMode = "dashboard" | "users" | "membershipOverview" | "membershipUsers" | "aiOrchestratorOverview" | "songPackOverview" | "audit" | "collection" | "placeholder";

type Overview = {
  totalUsers: number;
  trialUsers: number;
  proUsers: number;
  expiredUsers: number;
  revenueCents: number;
  totalGenerations: number;
  storageBytes: number;
  openTickets: number;
};

type MembershipOverview = {
  activeTrials: number;
  expiredTrials: number;
  activePro: number;
  conversionRate: number;
  revenueCents: number;
  monthlyRenewals: number;
  newSignups: number;
};

type SongPackOverview = {
  totalSongPacks: number;
  creditsUsed: number;
  topGenres: Array<{ genre: string; count: number }>;
  topParts: Array<{ part: string; count: number }>;
};

type AiOrchestratorOverview = {
  dailyRequests: number;
  averageTokensPerGeneration: number;
  totalTokens: number;
  estimatedLegacyTokens: number;
  estimatedTokenSavings: number;
  averageResponseTimeMs: number;
  errorRate: number;
  settings: {
    defaultModel: string | null;
    fallbackModel: string | null;
    temperature: number;
    maxOutputTokens: number;
    jsonValidationStrictness: string;
    cacheDurationSeconds: number;
  };
};

type Row = Record<string, unknown>;

type UserRole = "user" | "support" | "admin" | "super_admin";

type UserRow = {
  id: string;
  display_name: string | null;
  membership_type: "trial" | "pro" | "expired" | "admin" | null;
  membership_status: "trial_active" | "pro_active" | "expired" | "admin" | null;
  access_expires_at: string | null;
  trial_expires_at: string | null;
  created_at: string | null;
  user_roles?: Array<{ role: UserRole }>;
};

type MembershipUserRow = {
  id: string;
  display_name: string | null;
  membership_type: string | null;
  membership_status: string | null;
  created_at: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  pro_started_at: string | null;
  access_expires_at: string | null;
  total_payments: number | null;
};

type UserEditor = {
  id: string;
  displayName: string;
  membershipType: "trial" | "pro" | "expired" | "admin";
  membershipStatus: "trial_active" | "pro_active" | "expired" | "admin";
  accessExpiresAt: string;
  trialExpiresAt: string;
  role: UserRole;
};

type UserView = "all" | "active" | "trial" | "pro" | "suspended" | "admins";

type AdminTab = {
  key: string;
  label: string;
  mode: ResourceMode;
  resourceKey?: string;
  description?: string;
  userView?: UserView;
  membershipFilter?: string;
};

type AdminMenu = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  description: string;
  tabs: AdminTab[];
};

type DashboardBundle = {
  overview: Overview | null;
  membershipOverview: MembershipOverview | null;
  aiOverview: AiOrchestratorOverview | null;
  songPackOverview: SongPackOverview | null;
  payments: Row[];
  generations: Row[];
  credits: Row[];
  voiceUploads: Row[];
  logs: Row[];
  users: UserRow[];
  supportTickets: Row[];
};

const MENUS: AdminMenu[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin",
    description: "Platform overview, health, and quick actions.",
    tabs: [{ key: "overview", label: "Overview", mode: "dashboard", description: "Platform metrics and system status." }],
  },
  {
    key: "users",
    label: "Users",
    icon: Users,
    href: "/admin/users",
    description: "Manage accounts, membership state, credits, and admins.",
    tabs: [
      { key: "all", label: "All Users", mode: "users", userView: "all" },
      { key: "active", label: "Active", mode: "users", userView: "active" },
      { key: "trial", label: "Trial", mode: "users", userView: "trial" },
      { key: "pro", label: "Pro", mode: "users", userView: "pro" },
      { key: "suspended", label: "Suspended", mode: "placeholder", description: "Suspended-state tracking is not modeled yet. Use the user editor to manage membership and roles." },
      { key: "admins", label: "Admins", mode: "users", userView: "admins" },
      { key: "credits", label: "Credits", mode: "collection", resourceKey: "creditTransactions" },
      { key: "usage", label: "Usage", mode: "membershipUsers", membershipFilter: "all" },
      { key: "login-history", label: "Login History", mode: "placeholder", description: "Login history auditing is not stored in the current schema yet." },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    icon: Wallet,
    href: "/admin/payments",
    description: "Transactions, renewals, coupons, and revenue reporting.",
    tabs: [
      { key: "transactions", label: "Transactions", mode: "collection", resourceKey: "payments" },
      { key: "subscriptions", label: "Subscriptions", mode: "membershipUsers", membershipFilter: "pro_active" },
      { key: "refunds", label: "Refunds", mode: "collection", resourceKey: "payments", description: "Review refunded or denied payment activity." },
      { key: "payouts", label: "Payouts", mode: "placeholder", description: "MidiFlow does not currently maintain payout records." },
      { key: "coupons", label: "Coupons", mode: "collection", resourceKey: "coupons" },
      { key: "paypal", label: "PayPal", mode: "collection", resourceKey: "payments", description: "PayPal order and capture records." },
      { key: "revenue-reports", label: "Revenue Reports", mode: "collection", resourceKey: "reports" },
    ],
  },
  {
    key: "projects",
    label: "Projects",
    icon: FolderKanban,
    href: "/admin/projects",
    description: "Projects, exports, storage, and generated content.",
    tabs: [
      { key: "song-packs", label: "Song Packs", mode: "collection", resourceKey: "songPacks" },
      { key: "text-to-midi", label: "Text-to-MIDI", mode: "collection", resourceKey: "generations" },
      { key: "voice-to-midi", label: "Voice-to-MIDI", mode: "collection", resourceKey: "voiceUploads" },
      { key: "downloads", label: "Downloads", mode: "collection", resourceKey: "downloads" },
      { key: "storage", label: "Storage", mode: "collection", resourceKey: "storageFiles" },
      { key: "deleted-projects", label: "Deleted Projects", mode: "collection", resourceKey: "projects", description: "Project records currently reflect active stored rows only." },
    ],
  },
  {
    key: "ai",
    label: "AI & Generation",
    icon: Bot,
    href: "/admin/ai",
    description: "Models, queue health, prompts, and generation controls.",
    tabs: [
      { key: "models", label: "Models", mode: "aiOrchestratorOverview" },
      { key: "api-usage", label: "API Usage", mode: "aiOrchestratorOverview" },
      { key: "cost-optimization", label: "Cost Optimization", mode: "aiOrchestratorOverview" },
      { key: "generation-queue", label: "Generation Queue", mode: "collection", resourceKey: "generations" },
      { key: "json-validation", label: "JSON Validation", mode: "collection", resourceKey: "settings" },
      { key: "prompt-templates", label: "Prompt Templates", mode: "collection", resourceKey: "templates" },
      { key: "rate-limits", label: "Rate Limits", mode: "collection", resourceKey: "settings" },
    ],
  },
  {
    key: "music-brain",
    label: "Music Brain",
    icon: Music2,
    href: "/admin/music-brain",
    description: "Genres, moods, scales, rules, and knowledge primitives.",
    tabs: [
      { key: "genres", label: "Genres", mode: "collection", resourceKey: "genres" },
      { key: "instruments", label: "Instruments", mode: "collection", resourceKey: "instrumentRecommendations" },
      { key: "moods", label: "Moods", mode: "collection", resourceKey: "moods" },
      { key: "tempo-profiles", label: "Tempo Profiles", mode: "collection", resourceKey: "tempoRanges" },
      { key: "chord-libraries", label: "Chord Libraries", mode: "collection", resourceKey: "genreChords" },
      { key: "scale-libraries", label: "Scale Libraries", mode: "collection", resourceKey: "scales" },
      { key: "pattern-library", label: "Pattern Library", mode: "collection", resourceKey: "genreStructures" },
      { key: "midi-references", label: "MIDI References", mode: "collection", resourceKey: "templates" },
      { key: "rules-engine", label: "Rules Engine", mode: "collection", resourceKey: "musicRules" },
    ],
  },
  {
    key: "support",
    label: "Support",
    icon: Headset,
    href: "/admin/support",
    description: "Tickets, announcements, replies, and customer comms.",
    tabs: [
      { key: "tickets", label: "Tickets", mode: "collection", resourceKey: "supportTickets" },
      { key: "live-chat", label: "Live Chat", mode: "placeholder", description: "Live chat integration is not configured in the current platform." },
      { key: "email", label: "Email", mode: "collection", resourceKey: "emails" },
      { key: "contact-messages", label: "Contact Messages", mode: "collection", resourceKey: "supportTickets" },
      { key: "faq", label: "FAQ", mode: "collection", resourceKey: "templates" },
      { key: "announcements", label: "Announcements", mode: "collection", resourceKey: "announcements" },
      { key: "feedback", label: "Feedback", mode: "collection", resourceKey: "reports" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/admin/analytics",
    description: "Users, revenue, AI usage, conversion, and generation insights.",
    tabs: [
      { key: "overview", label: "Overview", mode: "dashboard" },
      { key: "users", label: "Users", mode: "membershipOverview" },
      { key: "revenue", label: "Revenue", mode: "collection", resourceKey: "payments" },
      { key: "ai-usage", label: "AI Usage", mode: "aiOrchestratorOverview" },
      { key: "music-generation", label: "Music Generation", mode: "songPackOverview" },
      { key: "retention", label: "Retention", mode: "membershipOverview" },
      { key: "conversion", label: "Conversion", mode: "membershipOverview" },
      { key: "traffic", label: "Traffic", mode: "placeholder", description: "Traffic analytics is not stored in the current schema yet." },
    ],
  },
  {
    key: "content",
    label: "Content",
    icon: FileText,
    href: "/admin/content",
    description: "Marketing copy, landing content, tutorials, and campaigns.",
    tabs: [
      { key: "landing-page", label: "Landing Page", mode: "collection", resourceKey: "announcements" },
      { key: "pricing", label: "Pricing", mode: "collection", resourceKey: "settings" },
      { key: "faq", label: "FAQ", mode: "collection", resourceKey: "templates" },
      { key: "blog", label: "Blog", mode: "placeholder", description: "Blog management is not persisted in the current admin schema." },
      { key: "tutorials", label: "Tutorials", mode: "collection", resourceKey: "templates" },
      { key: "announcements", label: "Announcements", mode: "collection", resourceKey: "announcements" },
      { key: "banners", label: "Banners", mode: "collection", resourceKey: "announcements" },
      { key: "email-templates", label: "Email Templates", mode: "collection", resourceKey: "emails" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings2,
    href: "/admin/settings",
    description: "Brand, auth, security, storage, integrations, and maintenance.",
    tabs: [
      { key: "general", label: "General", mode: "collection", resourceKey: "settings" },
      { key: "branding", label: "Branding", mode: "collection", resourceKey: "settings" },
      { key: "authentication", label: "Authentication", mode: "collection", resourceKey: "settings" },
      { key: "security", label: "Security", mode: "collection", resourceKey: "settings" },
      { key: "api-keys", label: "API Keys", mode: "collection", resourceKey: "apiKeys" },
      { key: "storage", label: "Storage", mode: "collection", resourceKey: "storageFiles" },
      { key: "email", label: "Email", mode: "collection", resourceKey: "emails" },
      { key: "paypal", label: "PayPal", mode: "collection", resourceKey: "settings" },
      { key: "notifications", label: "Notifications", mode: "collection", resourceKey: "settings" },
      { key: "backups", label: "Backups", mode: "collection", resourceKey: "reports" },
      { key: "roles-permissions", label: "Roles & Permissions", mode: "users", userView: "admins" },
      { key: "maintenance-mode", label: "Maintenance Mode", mode: "collection", resourceKey: "announcements" },
    ],
  },
];

function endpointForResource(tab: AdminTab) {
  if (tab.mode === "membershipOverview") return "/admin/memberships/overview";
  if (tab.mode === "membershipUsers") return "/admin/memberships/users";
  if (tab.mode === "aiOrchestratorOverview") return "/admin/ai-orchestrator/overview";
  if (tab.mode === "songPackOverview") return "/admin/song-packs/overview";
  if (tab.mode === "audit") return "/admin/logs/audit";
  if (tab.mode === "users") return "/admin/users";
  if (tab.mode === "collection" && tab.resourceKey) return `/admin/${tab.resourceKey}`;
  return "/admin/overview";
}

function bytesLabel(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function currencyLabel(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function editablePayload(row: Row) {
  const copy = { ...row };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  return JSON.stringify(copy, null, 2);
}

function toInputDate(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

function toIsoOrNull(value: string) {
  return value.trim() ? new Date(value).toISOString() : null;
}

function routeFor(menu: AdminMenu, tab: AdminTab) {
  const defaultTab = menu.tabs[0];
  if (menu.key === "dashboard") return "/admin";
  return tab.key === defaultTab.key ? `/admin/${menu.key}` : `/admin/${menu.key}/${tab.key}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function getAuthUser() {
  const result = await supabase?.auth.getUser();
  return result?.data.user ?? null;
}

function createDashboardMetrics(bundle: DashboardBundle) {
  const dayStart = startOfToday();
  const monthStart = startOfMonth();
  const completedPayments = bundle.payments.filter((row) => row.status === "completed");
  const revenueToday = completedPayments
    .filter((row) => new Date(String(row.created_at ?? row.updated_at ?? 0)) >= dayStart)
    .reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  const revenueThisMonth = completedPayments
    .filter((row) => new Date(String(row.created_at ?? row.updated_at ?? 0)) >= monthStart)
    .reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  const creditsUsedToday = bundle.credits
    .filter((row) => row.transaction_type === "usage" && new Date(String(row.created_at ?? 0)) >= dayStart)
    .reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
  const midiGenerationsToday = bundle.generations.filter((row) => new Date(String(row.created_at ?? 0)) >= dayStart).length;
  const voiceConversions = bundle.voiceUploads.filter((row) => new Date(String(row.created_at ?? 0)) >= dayStart).length;
  const adminCount = bundle.users.filter((user) => {
    const role = user.user_roles?.[0]?.role;
    return role === "admin" || role === "super_admin";
  }).length;
  const activeUsers = (bundle.overview?.trialUsers ?? 0) + (bundle.overview?.proUsers ?? 0) + adminCount;

  return {
    totalUsers: bundle.overview?.totalUsers ?? 0,
    activeUsers,
    trialUsers: bundle.overview?.trialUsers ?? 0,
    proUsers: bundle.overview?.proUsers ?? 0,
    revenueThisMonth,
    revenueToday,
    creditsUsedToday,
    midiGenerationsToday,
    songPacksGenerated: bundle.songPackOverview?.totalSongPacks ?? 0,
    voiceConversions,
    aiDailyRequests: bundle.aiOverview?.dailyRequests ?? 0,
    aiTokensToday: bundle.aiOverview?.totalTokens ?? 0,
  };
}

function filterUsersForView(users: UserRow[], view: UserView) {
  if (view === "all") return users;
  if (view === "trial") return users.filter((user) => user.membership_type === "trial");
  if (view === "pro") return users.filter((user) => user.membership_type === "pro");
  if (view === "admins") return users.filter((user) => {
    const role = user.user_roles?.[0]?.role;
    return role === "admin" || role === "super_admin";
  });
  if (view === "active") return users.filter((user) => ["trial_active", "pro_active", "admin"].includes(user.membership_status ?? ""));
  if (view === "suspended") return [];
  return users;
}

function filterRowsForTab(rows: Row[], menuKey: string, tabKey: string) {
  if (menuKey === "payments" && tabKey === "refunds") {
    return rows.filter((row) => ["refunded", "denied"].includes(String(row.status ?? "")));
  }
  if (menuKey === "projects" && tabKey === "deleted-projects") {
    return rows.filter((row) => row.deleted_at);
  }
  if (menuKey === "ai" && tabKey === "generation-queue") {
    return rows.filter((row) => ["queued", "processing", "failed"].includes(String(row.status ?? "")));
  }
  return rows;
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.03] p-6 text-sm text-[#c9c4d7]">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-3 leading-7">{body}</p>
    </section>
  );
}

export default function AdminDashboardPage() {
  const params = useParams<{ section?: string[] }>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardBundle | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [membershipOverview, setMembershipOverview] = useState<MembershipOverview | null>(null);
  const [membershipUsers, setMembershipUsers] = useState<MembershipUserRow[]>([]);
  const [aiOverview, setAiOverview] = useState<AiOrchestratorOverview | null>(null);
  const [songPackOverview, setSongPackOverview] = useState<SongPackOverview | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [payload, setPayload] = useState("{}");
  const [userEditor, setUserEditor] = useState<UserEditor | null>(null);

  const menuKey = params.section?.[0] ?? "dashboard";
  const activeMenu = MENUS.find((menu) => menu.key === menuKey) ?? MENUS[0];
  const activeTab = activeMenu.tabs.find((tab) => tab.key === (params.section?.[1] ?? activeMenu.tabs[0].key)) ?? activeMenu.tabs[0];

  const fetchAdmin = useCallback(async (path: string, authUserId: string, search?: URLSearchParams) => {
    const suffix = search && search.size ? `?${search.toString()}` : "";
    const response = await fetch(`${apiBase}${path}${suffix}`, {
      headers: { "x-user-id": authUserId },
      credentials: "include",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Administrator access required.");
    return body;
  }, []);

  const loadDashboard = useCallback(async (authUserId: string) => {
    const [overviewData, membershipOverviewData, aiData, songPackData, paymentsData, generationsData, creditsData, voiceData, logsData, usersData, supportData] = await Promise.all([
      fetchAdmin("/admin/overview", authUserId),
      fetchAdmin("/admin/memberships/overview", authUserId),
      fetchAdmin("/admin/ai-orchestrator/overview", authUserId),
      fetchAdmin("/admin/song-packs/overview", authUserId),
      fetchAdmin("/admin/payments", authUserId),
      fetchAdmin("/admin/generations", authUserId),
      fetchAdmin("/admin/creditTransactions", authUserId),
      fetchAdmin("/admin/voiceUploads", authUserId),
      fetchAdmin("/admin/logs/audit", authUserId),
      fetchAdmin("/admin/users", authUserId),
      fetchAdmin("/admin/supportTickets", authUserId),
    ]);

    setDashboard({
      overview: overviewData.data as Overview,
      membershipOverview: membershipOverviewData.data as MembershipOverview,
      aiOverview: aiData.data as AiOrchestratorOverview,
      songPackOverview: songPackData.data as SongPackOverview,
      payments: (paymentsData.data ?? []) as Row[],
      generations: (generationsData.data ?? []) as Row[],
      credits: (creditsData.data ?? []) as Row[],
      voiceUploads: (voiceData.data ?? []) as Row[],
      logs: (logsData.data ?? []) as Row[],
      users: (usersData.data ?? []) as UserRow[],
      supportTickets: (supportData.data ?? []) as Row[],
    });
  }, [fetchAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const authUser = await getAuthUser();
    if (!authUser) {
      setError("Authentication is required.");
      setLoading(false);
      return;
    }

    setUserId(authUser.id);
    setUserEmail(authUser.email ?? "admin@midiflow");
    setDashboard(null);
    setRows([]);
    setUsers([]);
    setMembershipOverview(null);
    setMembershipUsers([]);
    setAiOverview(null);
    setSongPackOverview(null);

    try {
      if (activeTab.mode === "dashboard") {
        await loadDashboard(authUser.id);
      } else if (activeTab.mode === "users") {
        const search = new URLSearchParams();
        if (query.trim()) search.set("query", query.trim());
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id, search);
        setUsers((body.data ?? []) as UserRow[]);
      } else if (activeTab.mode === "membershipUsers") {
        const search = new URLSearchParams();
        if (query.trim()) search.set("query", query.trim());
        if (activeTab.membershipFilter) search.set("filter", activeTab.membershipFilter);
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id, search);
        setMembershipUsers((body.data ?? []) as MembershipUserRow[]);
      } else if (activeTab.mode === "membershipOverview") {
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id);
        setMembershipOverview(body.data as MembershipOverview);
      } else if (activeTab.mode === "aiOrchestratorOverview") {
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id);
        setAiOverview(body.data as AiOrchestratorOverview);
      } else if (activeTab.mode === "songPackOverview") {
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id);
        setSongPackOverview(body.data as SongPackOverview);
      } else if (activeTab.mode === "audit" || activeTab.mode === "collection") {
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id);
        setRows((body.data ?? []) as Row[]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchAdmin, loadDashboard, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEditing(null);
    setPayload("{}");
    setUserEditor(null);
    setQuery("");
    setMobileMenuOpen(false);
  }, [activeMenu.key, activeTab.key]);

  const dashboardMetrics = useMemo(() => (dashboard ? createDashboardMetrics(dashboard) : null), [dashboard]);
  const visibleUsers = useMemo(() => filterUsersForView(users, activeTab.userView ?? "all"), [activeTab.userView, users]);
  const filteredRows = useMemo(() => {
    const base = filterRowsForTab(rows, activeMenu.key, activeTab.key);
    if (!query.trim()) return base;
    const needle = query.toLowerCase();
    return base.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [activeMenu.key, activeTab.key, query, rows]);
  const filteredMembershipUsers = useMemo(() => {
    if (!query.trim()) return membershipUsers;
    const needle = query.toLowerCase();
    return membershipUsers.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [membershipUsers, query]);

  async function saveGeneric() {
    try {
      setSaving(true);
      const parsed = JSON.parse(payload) as Row;
      const id = editing?.id ?? editing?.key;
      const path = editing ? `${endpointForResource(activeTab)}/${encodeURIComponent(String(id))}` : endpointForResource(activeTab);
      const response = await fetch(`${apiBase}${path}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        credentials: "include",
        body: JSON.stringify(parsed),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save resource.");
      toast.success(editing ? "Resource updated." : "Resource created.");
      setEditing(null);
      setPayload("{}");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Invalid JSON payload.");
    } finally {
      setSaving(false);
    }
  }

  async function saveUser() {
    if (!userEditor) return;
    try {
      setSaving(true);
      const response = await fetch(`${apiBase}/admin/users/${encodeURIComponent(userEditor.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        credentials: "include",
        body: JSON.stringify({
          displayName: userEditor.displayName.trim(),
          membershipType: userEditor.membershipType,
          membershipStatus: userEditor.membershipStatus,
          accessExpiresAt: toIsoOrNull(userEditor.accessExpiresAt),
          trialExpiresAt: toIsoOrNull(userEditor.trialExpiresAt),
          role: userEditor.role,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to update user.");
      toast.success("User updated.");
      setUserEditor(null);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: Row) {
    const id = row.id ?? row.key;
    if (!id || !window.confirm(`Delete ${String(row.name ?? row.title ?? id)}?`)) return;
    const response = await fetch(`${apiBase}${endpointForResource(activeTab)}/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: { "x-user-id": userId },
      credentials: "include",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.error ?? "Unable to delete resource.");
      return;
    }
    toast.success("Resource deleted.");
    await load();
  }

  function startUserEdit(user: UserRow) {
    setUserEditor({
      id: user.id,
      displayName: user.display_name ?? "",
      membershipType: (user.membership_type ?? "trial") as UserEditor["membershipType"],
      membershipStatus: (user.membership_status ?? "trial_active") as UserEditor["membershipStatus"],
      accessExpiresAt: toInputDate(user.access_expires_at),
      trialExpiresAt: toInputDate(user.trial_expires_at),
      role: user.user_roles?.[0]?.role ?? "user",
    });
  }

  async function runMembershipAction(action: "convert" | "extend-trial" | "end-trial", member: MembershipUserRow) {
    try {
      setSaving(true);
      const path = action === "convert"
        ? `/admin/memberships/${member.id}/convert`
        : action === "extend-trial"
          ? `/admin/memberships/${member.id}/extend-trial`
          : `/admin/memberships/${member.id}/end-trial`;

      const response = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        credentials: "include",
        body: action === "extend-trial" ? JSON.stringify({ days: 7 }) : JSON.stringify({}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to update membership.");
      toast.success(action === "convert" ? "User converted to Pro." : action === "extend-trial" ? "Trial extended by 7 days." : "Trial ended.");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to update membership.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#090816] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:px-8">
        <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,16,30,.96),rgba(9,8,22,.98))] p-4 shadow-[0_20px_60px_rgba(0,0,0,.28)] md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-lg font-black tracking-tight text-violet-200">MidiFlow</Link>
              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.18em] text-violet-200">Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative hidden w-72 md:block">
                <Search className="absolute left-3 top-3 size-4 text-[#938e9f]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="field pl-9" placeholder={`Search ${activeTab.label.toLowerCase()}`} />
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-2 text-right text-sm">
                <p className="font-semibold text-white">{userEmail || "Administrator"}</p>
                <p className="text-xs text-[#9b94af]">Full platform access</p>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen((value) => !value)} className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] md:hidden" aria-label="Toggle admin navigation">
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>

          <nav className={`${mobileMenuOpen ? "mt-4 grid" : "hidden md:grid"} gap-2 border-t border-white/10 pt-4 md:mt-6 md:grid-cols-5 lg:grid-cols-10`}>
            {MENUS.map((menu) => {
              const Icon = menu.icon;
              const isActive = menu.key === activeMenu.key;
              return (
                <Link key={menu.key} href={menu.href} className={`rounded-2xl px-4 py-3 text-sm transition ${isActive ? "bg-violet-600 text-white shadow-[0_12px_32px_rgba(139,92,246,.24)]" : "bg-white/[.03] text-[#c9c4d7] hover:bg-white/[.06] hover:text-white"}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4" />
                    <span className="font-semibold">{menu.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </header>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,13,27,.96),rgba(10,9,22,.98))] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">{activeMenu.label}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{activeTab.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aaa3bd]">{activeTab.description ?? activeMenu.description}</p>
            </div>
            {activeTab.mode === "collection" ? (
              <button type="button" onClick={() => { setEditing(null); setPayload("{}"); }} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold">
                <Plus className="size-4" />
                New record
              </button>
            ) : null}
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {activeMenu.tabs.map((tab) => (
              <Link key={tab.key} href={routeFor(activeMenu, tab)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${tab.key === activeTab.key ? "bg-white text-black" : "border border-white/10 bg-white/[.03] text-[#d2cde0] hover:bg-white/[.07] hover:text-white"}`}>
                {tab.label}
              </Link>
            ))}
          </div>

          <label className="relative mt-5 block md:hidden">
            <Search className="absolute left-3 top-3 size-4 text-[#938e9f]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field pl-9" placeholder={`Search ${activeTab.label.toLowerCase()}`} />
          </label>

          {error ? <p className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
          {loading ? <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-5 text-[#d3cee0]"><Loader2 className="size-4 animate-spin" />Loading admin data…</div> : null}

          {!loading && activeTab.mode === "placeholder" ? <PlaceholderCard title={activeTab.label} body={activeTab.description ?? "This area can be expanded as more admin data becomes available."} /> : null}

          {!loading && activeTab.mode === "dashboard" && dashboard && dashboardMetrics ? (
            <div className="mt-8 space-y-8">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Total users", value: dashboardMetrics.totalUsers.toLocaleString(), icon: Users },
                  { label: "Active users", value: dashboardMetrics.activeUsers.toLocaleString(), icon: Shield },
                  { label: "Trial users", value: dashboardMetrics.trialUsers.toLocaleString(), icon: Sparkles },
                  { label: "Pro users", value: dashboardMetrics.proUsers.toLocaleString(), icon: CreditCard },
                  { label: "Revenue this month", value: currencyLabel(dashboardMetrics.revenueThisMonth), icon: Wallet },
                  { label: "Revenue today", value: currencyLabel(dashboardMetrics.revenueToday), icon: Clock3 },
                  { label: "Credits used today", value: dashboardMetrics.creditsUsedToday.toLocaleString(), icon: Database },
                  { label: "MIDI generations today", value: dashboardMetrics.midiGenerationsToday.toLocaleString(), icon: WandSparkles },
                  { label: "Song packs generated", value: dashboardMetrics.songPacksGenerated.toLocaleString(), icon: FolderKanban },
                  { label: "Voice-to-MIDI conversions", value: dashboardMetrics.voiceConversions.toLocaleString(), icon: Music2 },
                  { label: "AI requests today", value: dashboardMetrics.aiDailyRequests.toLocaleString(), icon: Bot },
                  { label: "AI tokens today", value: dashboardMetrics.aiTokensToday.toLocaleString(), icon: Sparkles },
                ].map(({ label, value, icon: Icon }) => (
                  <article key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                    <Icon className="size-5 text-violet-300" />
                    <p className="mt-4 text-sm text-[#aaa3bd]">{label}</p>
                    <p className="mt-3 text-3xl font-bold">{value}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <div className="flex items-center gap-2">
                    <ActivityIcon />
                    <h2 className="font-semibold">Recent activity</h2>
                  </div>
                  <div className="mt-5 space-y-3">
                    {dashboard.logs.slice(0, 6).map((row, index) => (
                      <div key={String(row.id ?? index)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                        <p className="font-medium text-white">{String(row.action ?? "updated")} {String(row.entity_type ?? "resource")}</p>
                        <p className="mt-1 text-xs text-[#8f88a6]">{new Date(String(row.created_at ?? Date.now())).toLocaleString()}</p>
                      </div>
                    ))}
                    {!dashboard.logs.length ? <p className="text-sm text-[#aaa3bd]">No recent audit activity recorded yet.</p> : null}
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                    <div className="flex items-center gap-2">
                      <Bell className="size-5 text-violet-300" />
                      <h2 className="font-semibold">Notifications</h2>
                    </div>
                    <div className="mt-5 space-y-3 text-sm text-[#d4cfe0]">
                      <div className="rounded-xl bg-black/20 px-4 py-3">{dashboard.overview?.openTickets ?? 0} support tickets currently need attention.</div>
                      <div className="rounded-xl bg-black/20 px-4 py-3">{dashboard.membershipOverview?.expiredTrials ?? 0} trial accounts have expired and may be ready for reactivation campaigns.</div>
                      <div className="rounded-xl bg-black/20 px-4 py-3">AI error rate is {((dashboard.aiOverview?.errorRate ?? 0) * 100).toFixed(1)}% today.</div>
                    </div>
                  </article>
                  <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                    <div className="flex items-center gap-2">
                      <Shield className="size-5 text-violet-300" />
                      <h2 className="font-semibold">System status</h2>
                    </div>
                    <div className="mt-5 grid gap-3 text-sm text-[#d4cfe0] sm:grid-cols-2">
                      <div className="rounded-xl bg-black/20 px-4 py-3">AI Orchestrator: {dashboard.aiOverview && dashboard.aiOverview.errorRate < 0.1 ? "Healthy" : "Needs review"}</div>
                      <div className="rounded-xl bg-black/20 px-4 py-3">Payments: {dashboardMetrics.revenueToday >= 0 ? "Operational" : "Investigate"}</div>
                      <div className="rounded-xl bg-black/20 px-4 py-3">Storage: {bytesLabel(dashboard.overview?.storageBytes ?? 0)}</div>
                      <div className="rounded-xl bg-black/20 px-4 py-3">Support queue: {dashboard.overview?.openTickets ?? 0} open</div>
                    </div>
                  </article>
                </div>
              </div>

              <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                <h2 className="font-semibold">Quick actions</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { href: "/admin/users", label: "Manage users" },
                    { href: "/admin/payments", label: "Review payments" },
                    { href: "/admin/support", label: "Open support queue" },
                    { href: "/admin/settings", label: "Update settings" },
                  ].map((action) => (
                    <Link key={action.href} href={action.href} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white hover:border-violet-400/40">
                      {action.label}
                    </Link>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          {!loading && activeTab.mode === "membershipOverview" && membershipOverview ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Active trials", membershipOverview.activeTrials],
                ["Expired trials", membershipOverview.expiredTrials],
                ["Active Pro", membershipOverview.activePro],
                ["Conversion rate", `${(membershipOverview.conversionRate * 100).toFixed(1)}%`],
                ["Revenue", currencyLabel(membershipOverview.revenueCents)],
                ["Monthly renewals", membershipOverview.monthlyRenewals],
                ["New signups", membershipOverview.newSignups],
              ].map(([label, value]) => (
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5" key={String(label)}>
                  <p className="text-sm text-[#aaa3bd]">{label}</p>
                  <p className="mt-3 text-3xl font-bold">{String(value)}</p>
                </article>
              ))}
            </div>
          ) : null}

          {!loading && activeTab.mode === "aiOrchestratorOverview" && aiOverview ? (
            <div className="mt-8 grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Daily requests", aiOverview.dailyRequests],
                  ["Avg tokens / generation", aiOverview.averageTokensPerGeneration],
                  ["Total tokens", aiOverview.totalTokens],
                  ["Estimated legacy tokens", aiOverview.estimatedLegacyTokens],
                  ["Estimated token savings", aiOverview.estimatedTokenSavings],
                  ["Avg response time", `${aiOverview.averageResponseTimeMs} ms`],
                  ["Error rate", `${(aiOverview.errorRate * 100).toFixed(1)}%`],
                ].map(([label, value]) => <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5" key={String(label)}><p className="text-sm text-[#aaa3bd]">{label}</p><p className="mt-3 text-3xl font-bold">{String(value)}</p></article>)}
              </div>
              <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                <h2 className="font-semibold">Current AI settings</h2>
                <div className="mt-5 grid gap-3 text-sm text-[#d2cce1] sm:grid-cols-2">
                  <p>Default model: {aiOverview.settings.defaultModel ?? "membership-based default"}</p>
                  <p>Fallback model: {aiOverview.settings.fallbackModel ?? "membership fallback"}</p>
                  <p>Temperature: {aiOverview.settings.temperature}</p>
                  <p>Max output tokens: {aiOverview.settings.maxOutputTokens}</p>
                  <p>JSON strictness: {aiOverview.settings.jsonValidationStrictness}</p>
                  <p>Cache duration: {aiOverview.settings.cacheDurationSeconds}s</p>
                </div>
              </article>
            </div>
          ) : null}

          {!loading && activeTab.mode === "songPackOverview" && songPackOverview ? (
            <div className="mt-8 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
              <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                <p className="text-sm text-[#aaa3bd]">Total song packs</p>
                <p className="mt-3 text-3xl font-bold">{songPackOverview.totalSongPacks}</p>
                <p className="mt-6 text-sm text-[#aaa3bd]">Credits used</p>
                <p className="mt-3 text-3xl font-bold">{songPackOverview.creditsUsed}</p>
              </article>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <h2 className="font-semibold">Most generated genres</h2>
                  <div className="mt-4 space-y-3">{songPackOverview.topGenres.map((item) => <div key={item.genre} className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-sm"><span>{item.genre}</span><span className="text-violet-200">{item.count}</span></div>)}{!songPackOverview.topGenres.length ? <p className="text-sm text-[#aaa3bd]">No genre data yet.</p> : null}</div>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <h2 className="font-semibold">Most selected parts</h2>
                  <div className="mt-4 space-y-3">{songPackOverview.topParts.map((item) => <div key={item.part} className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-sm"><span>{item.part}</span><span className="text-violet-200">{item.count}</span></div>)}{!songPackOverview.topParts.length ? <p className="text-sm text-[#aaa3bd]">No part data yet.</p> : null}</div>
                </article>
              </div>
            </div>
          ) : null}

          {!loading && activeTab.mode === "users" ? (
            <>
              {activeTab.userView === "suspended" ? <PlaceholderCard title="Suspended users" body="Suspend/reactivate actions are part of the requested architecture, but the current backend schema does not yet persist a suspension state. Use the user editor to adjust role or membership state until a dedicated suspension field is introduced." /> : null}
              {activeTab.userView !== "suspended" ? (
                <>
                  {userEditor ? (
                    <section className="mt-6 rounded-2xl border border-violet-400/30 bg-violet-500/[.05] p-4">
                      <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-semibold"><UserCog className="size-4 text-violet-300" />Edit user</h2>
                        <button type="button" onClick={() => setUserEditor(null)} className="grid size-8 place-items-center rounded-lg bg-white/10"><X className="size-4" /></button>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="block text-sm font-medium">Display name<input value={userEditor.displayName} onChange={(event) => setUserEditor((current) => current ? { ...current, displayName: event.target.value } : current)} className="field mt-2" /></label>
                        <label className="block text-sm font-medium">Role<select value={userEditor.role} onChange={(event) => setUserEditor((current) => current ? { ...current, role: event.target.value as UserEditor["role"] } : current)} className="field mt-2"><option value="user">user</option><option value="support">support</option><option value="admin">admin</option><option value="super_admin">super_admin</option></select></label>
                        <label className="block text-sm font-medium">Membership type<select value={userEditor.membershipType} onChange={(event) => setUserEditor((current) => current ? { ...current, membershipType: event.target.value as UserEditor["membershipType"] } : current)} className="field mt-2"><option value="trial">trial</option><option value="pro">pro</option><option value="expired">expired</option><option value="admin">admin</option></select></label>
                        <label className="block text-sm font-medium">Membership status<select value={userEditor.membershipStatus} onChange={(event) => setUserEditor((current) => current ? { ...current, membershipStatus: event.target.value as UserEditor["membershipStatus"] } : current)} className="field mt-2"><option value="trial_active">trial_active</option><option value="pro_active">pro_active</option><option value="expired">expired</option><option value="admin">admin</option></select></label>
                        <label className="block text-sm font-medium">Trial expires<input type="datetime-local" value={userEditor.trialExpiresAt} onChange={(event) => setUserEditor((current) => current ? { ...current, trialExpiresAt: event.target.value } : current)} className="field mt-2" /></label>
                        <label className="block text-sm font-medium">Access expires<input type="datetime-local" value={userEditor.accessExpiresAt} onChange={(event) => setUserEditor((current) => current ? { ...current, accessExpiresAt: event.target.value } : current)} className="field mt-2" /></label>
                      </div>
                      <button type="button" onClick={() => void saveUser()} disabled={saving} className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold disabled:opacity-60"><Check className="size-4" />Save user</button>
                    </section>
                  ) : null}

                  <div className="data-scroll data-scroll-x mt-6 rounded-2xl border border-white/10">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[.03] text-[#a9a2bd]">
                        <tr>
                          <th className="p-4">User</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">Membership</th>
                          <th className="p-4">Trial expiry</th>
                          <th className="p-4">Access expiry</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUsers.map((user) => (
                          <tr className="border-b border-white/10 last:border-0" key={user.id}>
                            <td className="p-4"><p className="font-semibold text-white">{user.display_name ?? "Unnamed user"}</p><p className="mt-1 text-xs text-[#8f88a6]">{user.id}</p></td>
                            <td className="p-4">{user.user_roles?.[0]?.role ?? "user"}</td>
                            <td className="p-4"><p>{user.membership_type ?? "trial"}</p><p className="mt-1 text-xs text-[#8f88a6]">{user.membership_status ?? "trial_active"}</p></td>
                            <td className="p-4">{user.trial_expires_at ? new Date(user.trial_expires_at).toLocaleString() : "-"}</td>
                            <td className="p-4">{user.access_expires_at ? new Date(user.access_expires_at).toLocaleString() : "-"}</td>
                            <td className="p-4"><button type="button" onClick={() => startUserEdit(user)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15"><Pencil className="size-3.5" />Edit</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visibleUsers.length ? <p className="p-6 text-sm text-[#aaa3bd]">No users matched this tab.</p> : null}
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {!loading && activeTab.mode === "membershipUsers" ? (
            <div className="mt-6 grid gap-4">
              {filteredMembershipUsers.map((member) => (
                <article key={member.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{member.display_name ?? "Unnamed user"}</h2>
                      <p className="mt-1 text-xs text-[#8f88a6]">{member.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[.16em]">
                      <span className="rounded-full bg-violet-500/15 px-3 py-1 text-violet-200">{member.membership_type ?? "trial"}</span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[#d2cce1]">{member.membership_status ?? "trial_active"}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-[#c9c3da] md:grid-cols-3">
                    <p>Trial expiry: {member.trial_expires_at ? new Date(member.trial_expires_at).toLocaleString() : "-"}</p>
                    <p>Access expiry: {member.access_expires_at ? new Date(member.access_expires_at).toLocaleString() : "-"}</p>
                    <p>Total payments: {member.total_payments ?? 0}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void runMembershipAction("convert", member)} disabled={saving} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold disabled:opacity-60">Convert to Pro</button>
                    <button type="button" onClick={() => void runMembershipAction("extend-trial", member)} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Extend trial 7 days</button>
                    <button type="button" onClick={() => void runMembershipAction("end-trial", member)} disabled={saving} className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-60">End trial</button>
                  </div>
                </article>
              ))}
              {!filteredMembershipUsers.length ? <p className="rounded-2xl border border-white/10 bg-white/[.03] p-6 text-sm text-[#aaa3bd]">No membership users matched this tab.</p> : null}
            </div>
          ) : null}

          {!loading && (activeTab.mode === "audit" || activeTab.mode === "collection") ? (
            <>
              <section className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
                <div className="data-scroll data-scroll-x rounded-2xl border border-white/10">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <tbody>
                      {filteredRows.map((row, index) => (
                        <tr className="border-b border-white/10 last:border-0" key={String(row.id ?? row.key ?? index)}>
                          {Object.entries(row).slice(0, 6).map(([column, value]) => (
                            <td className="max-w-[240px] truncate p-4 align-top" key={column}>
                              <span className="text-[#aaa3bd]">{column}: </span>
                              {stringify(value)}
                            </td>
                          ))}
                          <td className="w-28 p-4">
                            {activeTab.mode === "collection" ? (
                              <div className="flex gap-2">
                                <button type="button" onClick={() => { setEditing(row); setPayload(editablePayload(row)); }} aria-label="Edit" className="grid size-8 place-items-center rounded-lg bg-white/8 hover:bg-white/15"><Pencil className="size-4" /></button>
                                <button type="button" onClick={() => void removeRow(row)} aria-label="Delete" className="grid size-8 place-items-center rounded-lg bg-red-500/10 text-red-200 hover:bg-red-500/20"><Trash2 className="size-4" /></button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredRows.length ? <p className="p-6 text-sm text-[#aaa3bd]">No records are available for this tab.</p> : null}
                </div>

                {activeTab.mode === "collection" ? (
                  <section className="rounded-2xl border border-violet-400/30 bg-violet-500/[.05] p-4">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 font-semibold"><Database className="size-4 text-violet-300" />{editing ? "Edit JSON payload" : "Create JSON payload"}</h2>
                      <button type="button" onClick={() => { setEditing(null); setPayload("{}"); }} className="grid size-8 place-items-center rounded-lg bg-white/10"><X className="size-4" /></button>
                    </div>
                    <textarea value={payload} onChange={(event) => setPayload(event.target.value)} className="mt-4 min-h-72 w-full resize-y rounded-xl border border-white/10 bg-[#0c0b18] p-4 font-mono text-xs leading-5 outline-none focus:border-violet-400" />
                    <button type="button" onClick={() => void saveGeneric()} disabled={saving} className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold disabled:opacity-60"><Check className="size-4" />Save</button>
                  </section>
                ) : null}
              </section>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function ActivityIcon() {
  return <Clock3 className="size-5 text-violet-300" />;
}
