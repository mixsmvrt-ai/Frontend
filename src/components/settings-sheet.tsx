"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Bell, BookOpen, Check, HelpCircle, Loader2, LogOut, Save, Shield, Sparkles, Settings, UserRound, Volume2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MembershipSnapshot } from "@/services/api";
import { accountApi, type AccountProfileResponse } from "@/services/account";
import { referralApi, type ReferralDashboard } from "@/services/referrals";

type SettingsSheetProps = {
  isAuthenticated: boolean;
  membership: MembershipSnapshot | null;
  showAdminLink: boolean;
  onSubscription: () => void;
  onNavigate: () => void;
};

function SheetLink({ label, href, icon: Icon, onNavigate }: { label: string; href: string; icon: LucideIcon; onNavigate: () => void }) {
  return <Link href={href} onClick={onNavigate} className="flex items-center gap-4 border-b border-white/[.1] px-4 py-4 text-[15px] font-semibold text-[#f2f2f4] transition last:border-0 hover:bg-white/[.06]">
    <Icon className="size-5 shrink-0 text-[#f5f5f7]" />
    <span className="min-w-0 flex-1">{label}</span>
    <span className="text-2xl leading-none text-[#6f7078]">›</span>
  </Link>;
}

function SheetButton({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-4 border-b border-white/[.1] px-4 py-4 text-left text-[15px] font-semibold text-[#f2f2f4] transition last:border-0 hover:bg-white/[.06]">
    <Icon className="size-5 shrink-0 text-[#f5f5f7]" />
    <span className="min-w-0 flex-1">{label}</span>
    <span className="text-2xl leading-none text-[#6f7078]">›</span>
  </button>;
}

type PanelName = "account" | "general" | "notifications" | "parental" | "safety" | "security" | "storage" | "data" | "ads" | "support" | "referrals";

function PanelView({ panel, profile, referral, loading, saving, onProfileChange, onSaveProfile, onSavePreferences }: { panel: PanelName; profile: AccountProfileResponse | null; referral: ReferralDashboard | null; loading: boolean; saving: boolean; onProfileChange: (profile: AccountProfileResponse) => void; onSaveProfile: () => void; onSavePreferences: () => void }) {
  const titles: Record<PanelName, string> = {
    account: "My account",
    general: "General",
    notifications: "Notifications",
    parental: "Parental controls",
    safety: "Safety",
    security: "Security and login",
    storage: "Storage",
    data: "Data controls",
    ads: "Ads controls",
    support: "Support center",
    referrals: "Referrals",
  };

  if (loading) return <div className="flex items-center gap-3 rounded-2xl bg-white/[.04] p-5 text-sm text-[#b5b5bd]"><Loader2 className="size-4 animate-spin" />Loading {titles[panel].toLowerCase()}...</div>;

  if (panel === "account") return <div className="space-y-4"><EditField label="Display name" value={profile?.display_name ?? ""} onChange={(value) => profile && onProfileChange({ ...profile, display_name: value })} /><InfoRow label="Email" value={profile?.email ?? "Available after sign in"} /><InfoRow label="Member since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Not available"} /><SaveButton saving={saving} onClick={onSaveProfile} label="Save account" /></div>;
  if (panel === "general") return <div className="space-y-4"><EditField label="Default BPM" type="number" value={String(profile?.preferences.default_bpm ?? 120)} onChange={(value) => profile && onProfileChange({ ...profile, preferences: { ...profile.preferences, default_bpm: Number(value) } })} /><EditField label="Default key" value={profile?.preferences.default_key ?? ""} onChange={(value) => profile && onProfileChange({ ...profile, preferences: { ...profile.preferences, default_key: value } })} /><EditField label="Default genre" value={profile?.preferences.default_genre ?? ""} onChange={(value) => profile && onProfileChange({ ...profile, preferences: { ...profile.preferences, default_genre: value } })} /><EditField label="Preferred DAW" value={profile?.preferences.daw_preference ?? ""} onChange={(value) => profile && onProfileChange({ ...profile, preferences: { ...profile.preferences, daw_preference: value } })} /><SaveButton saving={saving} onClick={onSavePreferences} label="Save general settings" /></div>;
  if (panel === "notifications") return <div className="space-y-3">{Object.entries(profile?.preferences.notification_settings ?? { productUpdates: true, billing: true, support: true }).map(([key, enabled]) => <label key={key} className="flex items-center justify-between rounded-2xl bg-white/[.04] px-4 py-3 text-sm"><span className="text-white">{key === "productUpdates" ? "Product updates" : key[0].toUpperCase() + key.slice(1)}</span><input type="checkbox" checked={Boolean(enabled)} onChange={(event) => profile && onProfileChange({ ...profile, preferences: { ...profile.preferences, notification_settings: { ...(profile.preferences.notification_settings ?? {}), [key]: event.target.checked } } })} className="size-4 accent-violet-500" /></label>)}<SaveButton saving={saving} onClick={onSavePreferences} label="Save notifications" /></div>;
  if (panel === "storage") return <div className="space-y-3"><InfoRow label="Autosave" value={profile?.preferences.auto_save ? "Enabled" : "Disabled"} /><InfoRow label="Autosave interval" value={`${profile?.preferences.autosave_interval_seconds ?? 60} seconds`} /><InfoRow label="Downloads" value="Your exported MIDI files are available in Downloads." /></div>;
  if (panel === "support") return <div className="space-y-4"><p className="text-sm leading-6 text-[#b5b5bd]">Get help with MIDI generation, projects, billing, or account access.</p><Link href="/support" className="block rounded-xl bg-violet-500 px-4 py-3 text-center text-sm font-bold">Open support center</Link></div>;
  if (panel === "referrals") return <div className="space-y-4"><InfoRow label="Referral code" value={referral?.code ?? "Unavailable"} /><div className="grid grid-cols-2 gap-3"><InfoRow label="Successful" value={String(referral?.stats.successfulReferrals ?? 0)} /><InfoRow label="Earnings" value={`$${(referral?.stats.totalEarnings ?? 0).toFixed(2)}`} /></div><p className="rounded-2xl bg-white/[.04] p-4 text-sm leading-6 text-[#b5b5bd]">Share your referral link and track signups, paid conversions, and commissions from your referral dashboard.</p><Link href="/referrals" className="block rounded-xl bg-violet-500 px-4 py-3 text-center text-sm font-bold">Open referrals dashboard</Link></div>;
  const descriptions: Record<Exclude<PanelName, "account" | "general" | "notifications" | "storage" | "support" | "referrals">, string> = { parental: "Manage family and shared access settings when available.", safety: "MidiFlow keeps generation and account actions protected by server-side access controls.", security: "Your sign-in and account security are managed through your authenticated session.", data: "Your projects, prompts, downloads, and preferences remain attached to your account.", ads: "MidiFlow currently does not use advertising controls in the workspace." };
  return <p className="rounded-2xl bg-white/[.04] p-5 text-sm leading-6 text-[#b5b5bd]">{descriptions[panel as keyof typeof descriptions]}</p>;
}

function EditField({ label, value, type = "text", onChange }: { label: string; value: string; type?: "text" | "number"; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-[#d9d9df]">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-violet-400" /></label>;
}

function SaveButton({ saving, onClick, label }: { saving: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold disabled:opacity-60">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{label}</button>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/[.04] px-4 py-3 text-sm"><span className="text-[#a9a9b0]">{label}</span><span className="max-w-[60%] truncate text-right font-semibold text-white">{value}</span></div>;
}

export function SettingsSheet({ isAuthenticated, membership, showAdminLink, onSubscription, onNavigate }: SettingsSheetProps) {
  const [activePanel, setActivePanel] = useState<PanelName | null>(null);
  const [profile, setProfile] = useState<AccountProfileResponse | null>(null);
  const [referral, setReferral] = useState<ReferralDashboard | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const accountStatus = !isAuthenticated
    ? "Sign in to sync your workspace"
    : membership?.type === "trial"
      ? `${membership.daysRemaining} trial days remaining`
      : membership?.type === "pro"
        ? `${membership.daysRemaining} days of ${membership.plan === "go" ? "Go" : "Plus"} remaining`
        : membership?.type === "expired" ? "Read-only access" : "Administrator access";

  const openPanel = async (panel: PanelName) => {
    setActivePanel(panel);
    if (!isAuthenticated || (panel !== "referrals" && profile) || (panel === "referrals" && referral)) return;
    setProfileLoading(true);
    try {
      if (panel === "referrals") {
        const response = await referralApi.dashboard();
        setReferral(response.data);
      } else {
        const response = await accountApi.profile();
        setProfile(response.data);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load this panel.");
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const response = await accountApi.updateProfile({ displayName: profile.display_name?.trim() ?? "", avatarPath: profile.avatar_path });
      setProfile((current) => current ? { ...current, ...response.data } : current);
      toast.success("Account updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update account.");
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const preferences = profile.preferences;
      await accountApi.updatePreferences({
        country: preferences.country,
        timezone: preferences.timezone,
        dawPreference: preferences.daw_preference,
        pluginPreference: preferences.plugin_preference,
        theme: preferences.theme ?? "system",
        language: preferences.language ?? "en",
        defaultBpm: Number(preferences.default_bpm ?? 120),
        defaultKey: preferences.default_key ?? "",
        defaultGenre: preferences.default_genre,
        autoSave: Boolean(preferences.auto_save),
        autosaveIntervalSeconds: Number(preferences.autosave_interval_seconds ?? 60),
        promptHistoryEnabled: Boolean(preferences.prompt_history_enabled),
        notificationSettings: preferences.notification_settings ?? {},
      });
      toast.success("Settings updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update settings.");
    } finally {
      setSaving(false);
    }
  };

  if (activePanel) return <div className="scrollbar-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[34px] border border-white/[.08] bg-[#1c1c1e] px-4 py-5 text-white shadow-[0_28px_100px_rgba(0,0,0,.65)]">
    <div className="flex items-center gap-3 px-3 pb-6"><button type="button" onClick={() => setActivePanel(null)} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.04]" aria-label="Back to settings"><ArrowLeft className="size-5" /></button><h2 className="text-xl font-bold">{({ account: "My account", general: "General", notifications: "Notifications", parental: "Parental controls", safety: "Safety", security: "Security and login", storage: "Storage", data: "Data controls", ads: "Ads controls", support: "Support center", referrals: "Referrals" } as Record<PanelName, string>)[activePanel]}</h2></div>
    <PanelView panel={activePanel} profile={profile} referral={referral} loading={profileLoading} saving={saving} onProfileChange={setProfile} onSaveProfile={() => void saveProfile()} onSavePreferences={() => void savePreferences()} />
  </div>;

  return <div className="scrollbar-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[34px] border border-white/[.08] bg-[#1c1c1e] px-4 py-5 text-white shadow-[0_28px_100px_rgba(0,0,0,.65)]">
    <div className="flex items-center justify-between px-3 pb-5">
      <div><p className="text-xl font-bold">Settings</p><p className="mt-1 text-xs text-[#9b9ba2]">Your MidiFlow workspace</p></div>
      <button type="button" onClick={onNavigate} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.04] text-2xl text-white" aria-label="Close settings"><X className="size-5" /></button>
    </div>

    <div className="overflow-hidden rounded-[28px] bg-[#2b2b2d]">
      <button type="button" onClick={() => void openPanel("account")} className="flex w-full items-center gap-4 border-b border-white/[.1] px-4 py-5 text-left">
        <span className="grid size-12 place-items-center rounded-full bg-violet-500 text-lg font-bold">{isAuthenticated ? "MF" : <UserRound className="size-5" />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-base font-bold">{isAuthenticated ? "My account" : "Sign in"}</span><span className="mt-1 block truncate text-xs text-[#a9a9b0]">{accountStatus}</span></span><span className="text-2xl text-[#77777e]">›</span>
      </button>
      <button type="button" onClick={onSubscription} className="flex w-full items-center gap-4 border-b border-white/[.1] px-4 py-4 text-left transition hover:bg-white/[.06]"><Sparkles className="size-5 text-sky-300" /><span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Subscription</span><span className="mt-1 block text-xs text-[#a9a9b0]">{membership?.type === "pro" ? `${membership.plan === "go" ? "Go" : "Plus"} active` : "Choose a plan"}</span></span><span className="text-2xl text-[#77777e]">›</span></button>
    </div>

    <p className="px-3 pb-2 pt-7 text-lg font-bold text-[#a9a9ad]">Customize MidiFlow</p>
    <div className="overflow-hidden rounded-[28px] bg-[#2b2b2d]">
      <SheetButton label="General" icon={Settings} onClick={() => void openPanel("general")} />
      <SheetButton label="Notifications" icon={Bell} onClick={() => void openPanel("notifications")} />
      <SheetLink label="Voice to MIDI" href="/voice-to-midi" icon={Volume2} onNavigate={onNavigate} />
      <SheetButton label="Parental controls" icon={UserRound} onClick={() => void openPanel("parental")} />
      <SheetButton label="Safety" icon={Shield} onClick={() => void openPanel("safety")} />
      <SheetButton label="Security and login" icon={Shield} onClick={() => void openPanel("security")} />
      <SheetButton label="Storage" icon={BookOpen} onClick={() => void openPanel("storage")} />
      <SheetButton label="Data controls" icon={UserRound} onClick={() => void openPanel("data")} />
      <SheetButton label="Ads controls" icon={Sparkles} onClick={() => void openPanel("ads")} />
      <SheetButton label="Referrals" icon={Sparkles} onClick={() => void openPanel("referrals")} />
      {showAdminLink ? <SheetLink label="Admin operations" href="/admin" icon={Shield} onNavigate={onNavigate} /> : null}
    </div>

    <p className="px-3 pb-2 pt-7 text-lg font-bold text-[#a9a9ad]">Get help</p>
    <div className="overflow-hidden rounded-[28px] bg-[#2b2b2d]">
      <SheetButton label="Support center" icon={HelpCircle} onClick={() => void openPanel("support")} />
      <button type="button" onClick={onSubscription} className="flex w-full items-center gap-4 border-b border-white/[.1] px-4 py-4 text-left text-[15px] font-semibold text-[#f2f2f4] transition last:border-0 hover:bg-white/[.06]"><Sparkles className="size-5" /><span className="min-w-0 flex-1">Pricing and plans</span><span className="text-2xl leading-none text-[#6f7078]">›</span></button>
    </div>

    {isAuthenticated ? <Link href="/logout" onClick={onNavigate} className="mt-7 flex items-center gap-4 rounded-[28px] bg-[#2b2b2d] px-4 py-5 text-[15px] font-semibold text-red-400"><LogOut className="size-5" />Log out</Link> : null}
  </div>;
}

export function SubscriptionDialog({ membership, onClose }: { membership: MembershipSnapshot | null; onClose: () => void }) {
  const prices = membership?.prices;
  const planCards = [
    { id: "go" as const, name: "Go", detail: "Text-to-MIDI essentials", fallback: "$5.99", features: ["Text to MIDI generation", "Projects and MIDI downloads", "Basic support"] },
    { id: "plus" as const, name: "Plus", detail: "The complete MidiFlow studio", fallback: "$19.99", features: ["Everything in Go", "Voice to MIDI and Song Pack Generator", "Fast support"] },
  ];

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Subscription plans">
    <div className="scrollbar-hidden relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#111113] p-6 shadow-[0_30px_100px_rgba(0,0,0,.7)] sm:p-8">
      <button type="button" onClick={onClose} className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-white/10 text-white" aria-label="Close subscription dialog"><X className="size-5" /></button>
      <div className="pr-12"><p className="text-sm font-bold uppercase tracking-[.16em] text-sky-300">Subscription</p><h2 className="mt-3 text-3xl font-black">Choose your creative pace.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#aaaab1]">Plans use the secure checkout already configured for your MidiFlow account.</p></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {planCards.map((plan) => { const price = prices?.[plan.id]; return <article key={plan.id} className={`rounded-[24px] border p-5 ${plan.id === "plus" ? "border-violet-400/70 bg-violet-500/10" : "border-white/10 bg-white/[.04]"}`}>
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{plan.name}</h3><p className="mt-1 text-sm text-[#aaaab1]">{plan.detail}</p></div>{plan.id === "plus" ? <span className="rounded-full bg-violet-500 px-2.5 py-1 text-[10px] font-bold uppercase">Popular</span> : null}</div>
          <p className="mt-6 text-4xl font-black">{price ? new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(price.amountCents / 100) : plan.fallback}<span className="ml-1 text-xs font-normal text-[#9999a1]">/ {price?.days ?? 30} days</span></p>
          <Link href={`/upgrade?plan=${plan.id}`} onClick={onClose} className={`mt-6 block rounded-xl px-4 py-3 text-center text-sm font-bold ${plan.id === "plus" ? "bg-violet-500 text-white" : "bg-white/10 hover:bg-white/15"}`}>{membership?.plan === plan.id ? "Current plan" : `Choose ${plan.name}`}</Link>
          <ul className="mt-6 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-[#d8d8dd]"><Check className="size-4 shrink-0 text-sky-300" />{feature}</li>)}</ul>
        </article>; })}
      </div>
    </div>
  </div>;
}
