"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { useMembership } from "@/features/billing/use-membership";
import { supabase } from "@/lib/supabase/browser";
import { accountApi, type AccountProfileResponse } from "@/services/account";

export default function ProfilePage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const { membership } = useMembership({ enabled: authResolved && isAuthenticated, redirectOnMissingUser: false });
  const [profile, setProfile] = useState<AccountProfileResponse | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authResolved) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [{ data }, auth] = await Promise.all([
          accountApi.profile(),
          supabase?.auth.getUser() ?? Promise.resolve({ data: { user: null } }),
        ]);
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setAvatarPath(data.avatar_path ?? "");
        setEmail(auth.data.user?.email ?? "");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [authResolved, isAuthenticated]);

  async function saveProfile() {
    if (!isAuthenticated) {
      promptSignIn("/profile");
      return;
    }
    setSaving(true);
    try {
      const response = await accountApi.updateProfile({
        displayName: displayName.trim(),
        avatarPath: avatarPath.trim() || null,
      });
      setProfile((current) => current ? { ...current, ...response.data } : current);
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-violet-300">Account</p>
            <h1 className="text-3xl font-black tracking-tight">Profile</h1>
            <p className="mt-2 max-w-2xl text-[#aaa3bd]">Update your account identity, contact details, and creator-facing workspace profile.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] px-5 py-4 text-sm text-[#c8c2d6]">
            <p className="font-semibold text-white">Membership</p>
            <p className="mt-1 capitalize">{isAuthenticated ? membership?.type ?? profile?.membership_type ?? "trial" : "guest"} · {isAuthenticated ? membership?.status ?? profile?.membership_status ?? "trial_active" : "read-only preview"}</p>
            <p className="mt-1 text-xs text-[#9d97b0]">{isAuthenticated ? membership?.active ? `${membership.daysRemaining} days remaining` : "Read-only access" : "Sign in to manage your account profile."}</p>
          </div>
        </header>

        {loading ? <div className="glass flex items-center gap-3 rounded-2xl p-6 text-[#c8c2d6]"><Loader2 className="size-4 animate-spin" />Loading account profile…</div> : null}

        {!loading ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <section className="glass rounded-2xl p-6">
              <h2 className="text-lg font-bold">Identity</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium sm:col-span-2">
                  Display name
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field mt-2" placeholder="How your name appears across projects" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium sm:col-span-2">
                  Email
                  <input value={email} readOnly className="field mt-2 opacity-70" />
                </label>
                <label className="block text-sm font-medium sm:col-span-2">
                  Avatar path
                  <input value={avatarPath} onChange={(event) => setAvatarPath(event.target.value)} className="field mt-2" placeholder="Optional storage path or asset URL" disabled={!isAuthenticated} />
                </label>
              </div>
              <button type="button" onClick={() => void saveProfile()} disabled={saving || (isAuthenticated && displayName.trim().length < 1)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isAuthenticated ? "Save profile" : "Sign in to edit"}
              </button>
            </section>

            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 text-violet-200">
                <ShieldCheck className="size-5" />
                <h2 className="text-lg font-bold text-white">Workspace access</h2>
              </div>
              <div className="mt-5 grid gap-4">
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Account ID</p>
                  <p className="mt-2 break-all text-sm text-[#d8d2e3]">{profile?.id ?? "Available after sign in"}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Created</p>
                  <p className="mt-2 text-sm text-[#d8d2e3]">{profile?.created_at ? new Date(profile.created_at).toLocaleString() : "Unknown"}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-xs uppercase tracking-[.16em] text-[#918aa6]">Access mode</p>
                  <p className="mt-2 text-sm text-[#d8d2e3]">{!isAuthenticated ? "Guest preview" : membership?.readOnly ? "Read-only" : "Full creation access"}</p>
                </article>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}