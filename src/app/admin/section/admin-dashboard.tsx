"use client";

import Link from "next/link";
import Image from "next/image";
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
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabase/browser";
import type { ReferralSettings } from "@/services/referrals";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type ResourceMode = "dashboard" | "users" | "membershipOverview" | "membershipUsers" | "aiOrchestratorOverview" | "songPackOverview" | "referralOverview" | "referralSettings" | "audit" | "collection" | "placeholder";

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

type ReferralOverview = {
  totalReferralRevenue: number;
  totalCommissionsPaid: number;
  pendingCommissions: number;
  availableCommissions: number;
  topReferrers: Array<{ user: string; referralCode: string; earnings: number; signups: number; paidReferrals: number }>;
  conversionRate: number;
  totalReferralSignups: number;
  totalReferralPurchases: number;
  monthlyReferralGrowth: { signups: number; purchases: number; clicks: number };
  totalPayouts: number;
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
  editable?: boolean;
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
      { key: "referrals", label: "Referrals", mode: "referralOverview", description: "Referral revenue, commissions, conversion, and top affiliates." },
      { key: "referrers", label: "Referrers", mode: "collection", resourceKey: "referrals", editable: false, description: "Review top referrers, their codes, signups, and wallet balances." },
      { key: "commissions", label: "Commissions", mode: "collection", resourceKey: "referrals/commissions", editable: false, description: "Pending, eligible, paid, refunded, and cancelled referral commissions." },
      { key: "payout-requests", label: "Payout Requests", mode: "collection", resourceKey: "referrals/payouts", editable: false, description: "Approve, reject, and review referral payout requests." },
      { key: "payout-history", label: "Payout History", mode: "collection", resourceKey: "referrals/payout-history", editable: false, description: "Completed referral payout transactions and processor references." },
      { key: "referral-settings", label: "Settings", mode: "referralSettings", description: "Configure referral commission, payouts, eligibility, and fraud-related limits." },
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
      { key: "artists", label: "Artists", mode: "placeholder", description: "Manage artist vibe profiles, aliases, tempo tendencies, mood traits, and plugin categories." },
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
  if (tab.mode === "referralOverview") return "/admin/referrals/overview";
  if (tab.mode === "referralSettings") return "/admin/referrals/settings";
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
  if (menu.key === "music-brain" && tab.key === "artists") return "/admin/artistProfiles";
  if (menu.key === "music-brain" && tab.key === "genres") return "/admin/genreProfiles";
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

function createTrendData(bundle: DashboardBundle) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    return { date, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), revenue: 0, generations: 0 };
  });
  const dayKey = (value: string) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date.getTime(); };
  bundle.payments.filter((row) => row.status === "completed").forEach((row) => {
    const target = days.find((day) => day.date.getTime() === dayKey(String(row.created_at ?? row.updated_at ?? "")));
    if (target) target.revenue += Number(row.amount_cents ?? 0) / 100;
  });
  bundle.generations.forEach((row) => {
    const target = days.find((day) => day.date.getTime() === dayKey(String(row.created_at ?? "")));
    if (target) target.generations += 1;
  });
  return days;
}

function createMembershipChartData(bundle: DashboardBundle) {
  return [
    { name: "Trial", value: bundle.overview?.trialUsers ?? 0, color: "#a7e2d9" },
    { name: "Plus", value: bundle.overview?.proUsers ?? 0, color: "#a875ff" },
    { name: "Expired", value: bundle.overview?.expiredUsers ?? 0, color: "#f0a4c4" },
  ];
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
  const [referralOverview, setReferralOverview] = useState<ReferralOverview | null>(null);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [payload, setPayload] = useState("{}");
  const [userEditor, setUserEditor] = useState<UserEditor | null>(null);

  const menuKey = params.section?.[0] ?? "dashboard";
  const activeMenu = MENUS.find((menu) => menu.key === menuKey) ?? MENUS[0];
  const contentMenu = activeMenu.key === "dashboard" ? MENUS.find((menu) => menu.key === "analytics") ?? activeMenu : activeMenu;
  const activeTab = contentMenu.tabs.find((tab) => tab.key === (params.section?.[1] ?? contentMenu.tabs[0].key)) ?? contentMenu.tabs[0];

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
    setReferralOverview(null);
    setReferralSettings(null);

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
      } else if (activeTab.mode === "referralOverview") {
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id);
        setReferralOverview(body.data as ReferralOverview);
      } else if (activeTab.mode === "referralSettings") {
        const body = await fetchAdmin(endpointForResource(activeTab), authUser.id);
        setReferralSettings(body.data as ReferralSettings);
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
  const trendData = useMemo(() => (dashboard ? createTrendData(dashboard) : []), [dashboard]);
  const membershipChartData = useMemo(() => (dashboard ? createMembershipChartData(dashboard) : []), [dashboard]);
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

  async function saveReferralSettings() {
    if (!referralSettings) return;
    try {
      setSaving(true);
      const response = await fetch(`${apiBase}/admin/referrals/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        credentials: "include",
        body: JSON.stringify(referralSettings),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save referral settings.");
      setReferralSettings(body.data as ReferralSettings);
      toast.success("Referral settings updated.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to save referral settings.");
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
    <main data-admin-shell className="min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#303139] p-3 text-[#f2f4f4] md:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-[1500px] overflow-hidden rounded-[24px] border border-white/[.06] bg-[#171820] shadow-[0_28px_80px_rgba(9,10,16,.35)]">
        <aside className="hidden w-16 shrink-0 flex-col items-center border-r border-white/[.06] bg-[#111219] py-5 md:flex">
          <Link href="/dashboard" className="grid size-9 place-items-center rounded-xl bg-black/30" aria-label="MidiFlow dashboard"><Image src="/midiflow-logo.svg" alt="MidiFlow" width={20} height={20} /></Link>
          <div className="mt-10 flex flex-1 flex-col items-center gap-6 text-[#747986]">
            {MENUS.slice(0, 8).map((menu) => {
              const Icon = menu.icon;
              return <Link key={menu.key} href={menu.href} aria-label={menu.label} className={`grid size-9 place-items-center rounded-lg transition ${menu.key === activeMenu.key ? "bg-[#253c3e] text-[#a7e2d9]" : "hover:bg-white/[.06] hover:text-white"}`}><Icon className="size-4" /></Link>;
            })}
          </div>
          <Settings2 className="size-4 text-[#747986]" />
        </aside>

        <aside className={`${mobileMenuOpen ? "absolute inset-0 z-20 flex" : "hidden"} w-64 shrink-0 flex-col border-r border-white/[.06] bg-[#171820] p-5 md:relative md:flex`}>
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-xl font-black tracking-tight text-white"><Image src="/midiflow-logo.svg" alt="" width={22} height={22} />MidiFlow</Link>
            <button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-8 place-items-center rounded-lg bg-white/[.06] md:hidden" aria-label="Close admin navigation"><X className="size-4" /></button>
          </div>
          <p className="mt-10 text-[10px] font-bold uppercase tracking-[.2em] text-[#707581]">Workspace</p>
          <nav className="mt-4 space-y-1.5">
            {MENUS.map((menu) => {
              const Icon = menu.icon;
              const isActive = menu.key === activeMenu.key;
              return <Link key={menu.key} href={menu.href} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? "bg-[#a7e2d9] font-bold text-[#13151b]" : "text-[#969ba6] hover:bg-white/[.05] hover:text-white"}`}><Icon className="size-4" /><span>{menu.label}</span></Link>;
            })}
          </nav>
          <div className="mt-auto rounded-xl border border-white/[.06] bg-white/[.025] p-3 text-xs text-[#858b97]">System online<br /><span className="text-[#a7e2d9]">All services operational</span></div>
        </aside>

        <div className="min-w-0 flex-1 bg-[#1b1c25]">
          <header className="flex items-center gap-3 border-b border-white/[.06] px-4 py-4 md:px-7">
            <button type="button" onClick={() => setMobileMenuOpen((value) => !value)} className="grid size-9 place-items-center rounded-lg bg-white/[.05] md:hidden" aria-label="Toggle admin navigation"><Menu className="size-4" /></button>
            <label className="relative min-w-0 flex-1 md:max-w-xl">
              <Search className="absolute left-3 top-3 size-4 text-[#777d89]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="field h-10 border-0 bg-[#242631] pl-10 text-sm" placeholder={`Search ${activeTab.label.toLowerCase()}`} />
            </label>
            <div className="hidden text-right text-sm sm:block"><p className="font-semibold text-white">{userEmail || "Administrator"}</p><p className="text-xs text-[#7f8590]">Administrator</p></div>
            <button type="button" className="grid size-9 place-items-center rounded-full border border-white/[.08] bg-white/[.04]" aria-label="Notifications"><Bell className="size-4 text-[#b4bbc2]" /></button>
          </header>

        <section className="p-4 md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">{contentMenu.label}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{activeTab.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aaa3bd]">{activeTab.description ?? contentMenu.description}</p>
            </div>
            {activeTab.mode === "collection" && activeTab.editable !== false ? (
              <button type="button" onClick={() => { setEditing(null); setPayload("{}"); }} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold">
                <Plus className="size-4" />
                New record
              </button>
            ) : null}
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {contentMenu.tabs.map((tab) => (
              <Link key={tab.key} href={routeFor(contentMenu, tab)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${tab.key === activeTab.key ? "bg-white text-black" : "border border-white/10 bg-white/[.03] text-[#d2cde0] hover:bg-white/[.07] hover:text-white"}`}>
                {tab.label}
              </Link>
            ))}
          </div>

          <label className="relative mt-5 block md:hidden">
            <Search className="absolute right-3 top-3 size-4 text-[#938e9f]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field pr-9" placeholder={`Search ${activeTab.label.toLowerCase()}`} />
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
                ].slice(0, 6).map(({ label, value, icon: Icon }) => (
                  <article key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                    <Icon className="size-5 text-violet-300" />
                    <p className="mt-4 text-sm text-[#aaa3bd]">{label}</p>
                    <p className="mt-3 text-3xl font-bold">{value}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
                <article className="rounded-2xl border border-white/[.07] bg-[#20212b] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm font-semibold text-white">Revenue overview</p><p className="mt-1 text-xs text-[#858b97]">Revenue and generation activity over the last 14 days</p></div>
                    <span className="rounded-md border border-white/[.08] px-2.5 py-1 text-[11px] text-[#9ca2ad]">Last 14 days</span>
                  </div>
                  <div className="mt-5 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <defs><linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a875ff" stopOpacity={0.36} /><stop offset="100%" stopColor="#a875ff" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid stroke="#ffffff" strokeOpacity={0.06} vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: "#777d89", fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
                        <YAxis yAxisId="revenue" tick={{ fill: "#777d89", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                        <YAxis yAxisId="generations" orientation="right" hide />
                        <Tooltip contentStyle={{ background: "#171820", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff" }} labelStyle={{ color: "#a7e2d9" }} />
                        <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#a875ff" strokeWidth={2} fill="url(#adminRevenueFill)" name="Revenue" />
                        <Area yAxisId="generations" type="monotone" dataKey="generations" stroke="#a7e2d9" strokeWidth={2} fill="none" name="Generations" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="rounded-2xl border border-white/[.07] bg-[#20212b] p-5">
                  <p className="text-sm font-semibold text-white">Membership mix</p>
                  <p className="mt-1 text-xs text-[#858b97]">Current account distribution</p>
                  <div className="relative mt-3 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={membershipChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={78} paddingAngle={3} stroke="none">{membershipChartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ background: "#171820", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff" }} /></PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><p className="text-2xl font-bold text-white">{dashboardMetrics.totalUsers.toLocaleString()}</p><p className="text-[10px] uppercase tracking-[.14em] text-[#7f8590]">Users</p></div></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">{membershipChartData.map((entry) => <div key={entry.name}><span className="mx-auto mb-1 block size-2 rounded-full" style={{ backgroundColor: entry.color }} /><p className="text-[#a7adb8]">{entry.name}</p><p className="mt-1 font-semibold text-white">{entry.value.toLocaleString()}</p></div>)}</div>
                </article>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_.85fr]">
                <article className="rounded-2xl border border-white/[.07] bg-[#20212b] p-5">
                  <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Generation activity</p><p className="mt-1 text-xs text-[#858b97]">MIDI output by day</p></div><BarChart3 className="size-4 text-[#a7e2d9]" /></div>
                  <div className="mt-5 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#ffffff" strokeOpacity={0.06} vertical={false} /><XAxis dataKey="label" tick={{ fill: "#777d89", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} /><YAxis tick={{ fill: "#777d89", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ background: "#171820", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff" }} /><Bar dataKey="generations" fill="#a7e2d9" radius={[4, 4, 0, 0]} name="Generations" /></BarChart></ResponsiveContainer></div>
                </article>
                <article className="rounded-2xl border border-white/[.07] bg-[#20212b] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Payout requests</p><p className="mt-1 text-xs text-[#858b97]">Recent payment activity</p></div><Link href="/admin/payments" className="text-xs font-semibold text-[#a7e2d9]">View all</Link></div><div className="mt-4 space-y-3">{dashboard.payments.slice(0, 4).map((payment, index) => <div key={String(payment.id ?? index)} className="flex items-center justify-between gap-3 border-b border-white/[.06] pb-3 last:border-0 last:pb-0"><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#e4e6e8]">{String(payment.payment_kind ?? "Payment")}</p><p className="mt-1 text-[11px] text-[#777d89]">{new Date(String(payment.created_at ?? Date.now())).toLocaleDateString()}</p></div><span className="text-sm font-semibold text-[#a7e2d9]">{currencyLabel(Number(payment.amount_cents ?? 0))}</span></div>)}{!dashboard.payments.length ? <p className="text-xs text-[#858b97]">No payments recorded yet.</p> : null}</div></article>
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

          {!loading && activeTab.mode === "referralOverview" && referralOverview ? (
            <div className="mt-8 space-y-8">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Total referral revenue", currencyLabel(Math.round(referralOverview.totalReferralRevenue * 100))],
                  ["Total commissions paid", currencyLabel(Math.round(referralOverview.totalCommissionsPaid * 100))],
                  ["Pending commissions", currencyLabel(Math.round(referralOverview.pendingCommissions * 100))],
                  ["Available commissions", currencyLabel(Math.round(referralOverview.availableCommissions * 100))],
                  ["Referral signups", referralOverview.totalReferralSignups.toLocaleString()],
                  ["Referral purchases", referralOverview.totalReferralPurchases.toLocaleString()],
                  ["Conversion rate", `${(referralOverview.conversionRate * 100).toFixed(1)}%`],
                  ["Total payouts", currencyLabel(Math.round(referralOverview.totalPayouts * 100))],
                ].map(([label, value]) => (
                  <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5" key={String(label)}>
                    <p className="text-sm text-[#aaa3bd]">{label}</p>
                    <p className="mt-3 text-3xl font-bold">{String(value)}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <h2 className="font-semibold">Top referrers</h2>
                  <div className="mt-5 space-y-3">
                    {referralOverview.topReferrers.map((item) => (
                      <div key={`${item.referralCode}-${item.user}`} className="rounded-xl bg-black/20 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3"><p className="font-semibold text-white">{item.user}</p><p className="text-violet-200">{currencyLabel(Math.round(item.earnings * 100))}</p></div>
                        <p className="mt-1 text-xs text-[#8f88a6]">{item.referralCode} · {item.signups} signups · {item.paidReferrals} paid referrals</p>
                      </div>
                    ))}
                    {!referralOverview.topReferrers.length ? <p className="text-sm text-[#aaa3bd]">No referral leaders yet.</p> : null}
                  </div>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <h2 className="font-semibold">Monthly growth</h2>
                  <div className="mt-5 grid gap-3 text-sm text-[#d4cfe0]">
                    <div className="rounded-xl bg-black/20 px-4 py-3">Signups this month: {referralOverview.monthlyReferralGrowth.signups}</div>
                    <div className="rounded-xl bg-black/20 px-4 py-3">Purchases this month: {referralOverview.monthlyReferralGrowth.purchases}</div>
                    <div className="rounded-xl bg-black/20 px-4 py-3">Clicks this month: {referralOverview.monthlyReferralGrowth.clicks}</div>
                  </div>
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

          {!loading && activeTab.mode === "referralSettings" && referralSettings ? (
            <section className="mt-6 rounded-2xl border border-violet-400/30 bg-violet-500/[.05] p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm font-medium">Program enabled<select value={String(referralSettings.enabled)} onChange={(event) => setReferralSettings((current) => current ? { ...current, enabled: event.target.value === "true" } : current)} className="field mt-2"><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
                <label className="block text-sm font-medium">Commission type<select value={referralSettings.defaultCommissionType} onChange={(event) => setReferralSettings((current) => current ? { ...current, defaultCommissionType: event.target.value as ReferralSettings["defaultCommissionType"] } : current)} className="field mt-2"><option value="percentage">percentage</option><option value="flat">flat</option></select></label>
                <label className="block text-sm font-medium">Default commission rate<input type="number" min={0} max={100} value={referralSettings.defaultCommissionRate} onChange={(event) => setReferralSettings((current) => current ? { ...current, defaultCommissionRate: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Flat commission cents<input type="number" min={0} value={referralSettings.flatCommissionCents} onChange={(event) => setReferralSettings((current) => current ? { ...current, flatCommissionCents: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Minimum payout cents<input type="number" min={100} value={referralSettings.minimumPayoutCents} onChange={(event) => setReferralSettings((current) => current ? { ...current, minimumPayoutCents: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Eligibility delay days<input type="number" min={0} value={referralSettings.eligibilityDelayDays} onChange={(event) => setReferralSettings((current) => current ? { ...current, eligibilityDelayDays: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Cookie duration days<input type="number" min={1} value={referralSettings.cookieDurationDays} onChange={(event) => setReferralSettings((current) => current ? { ...current, cookieDurationDays: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Referral expiration days<input type="number" min={1} value={referralSettings.referralExpirationDays} onChange={(event) => setReferralSettings((current) => current ? { ...current, referralExpirationDays: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Max commission per user cents<input type="number" min={0} value={referralSettings.maximumCommissionPerUserCents} onChange={(event) => setReferralSettings((current) => current ? { ...current, maximumCommissionPerUserCents: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Max payout per month cents<input type="number" min={0} value={referralSettings.maximumPayoutPerMonthCents} onChange={(event) => setReferralSettings((current) => current ? { ...current, maximumPayoutPerMonthCents: Number(event.target.value) } : current)} className="field mt-2" /></label>
                <label className="block text-sm font-medium">Allow self-referrals<select value={String(referralSettings.allowSelfReferrals)} onChange={(event) => setReferralSettings((current) => current ? { ...current, allowSelfReferrals: event.target.value === "true" } : current)} className="field mt-2"><option value="false">false</option><option value="true">true</option></select></label>
                <label className="block text-sm font-medium">Allow multiple referrals<select value={String(referralSettings.allowMultipleReferrals)} onChange={(event) => setReferralSettings((current) => current ? { ...current, allowMultipleReferrals: event.target.value === "true" } : current)} className="field mt-2"><option value="false">false</option><option value="true">true</option></select></label>
                <label className="block text-sm font-medium">Automatic approval<select value={String(referralSettings.automaticApproval)} onChange={(event) => setReferralSettings((current) => current ? { ...current, automaticApproval: event.target.value === "true" } : current)} className="field mt-2"><option value="false">false</option><option value="true">true</option></select></label>
                <label className="block text-sm font-medium">Manual approval<select value={String(referralSettings.manualApproval)} onChange={(event) => setReferralSettings((current) => current ? { ...current, manualApproval: event.target.value === "true" } : current)} className="field mt-2"><option value="true">true</option><option value="false">false</option></select></label>
              </div>
              <button type="button" onClick={() => void saveReferralSettings()} disabled={saving} className="mt-5 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold disabled:opacity-60"><Check className="size-4" />Save referral settings</button>
            </section>
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
                            {activeTab.mode === "collection" && activeTab.editable !== false ? (
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

                {activeTab.mode === "collection" && activeTab.editable !== false ? (
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
      </div>
    </main>
  );
}

function ActivityIcon() {
  return <Clock3 className="size-5 text-violet-300" />;
}
