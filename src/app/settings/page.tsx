"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { promptSignIn, useViewerAuth } from "@/features/auth/use-viewer-auth";
import { accountApi, defaultPreferences, type AccountProfileResponse } from "@/services/account";

type SettingsState = AccountProfileResponse["preferences"];

export default function SettingsPage() {
  const { isAuthenticated, authResolved } = useViewerAuth();
  const [settings, setSettings] = useState<SettingsState>(defaultPreferences);
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
        const { data } = await accountApi.profile();
        setSettings(data.preferences);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [authResolved, isAuthenticated]);

  async function saveSettings() {
    if (!isAuthenticated) {
      promptSignIn("/settings");
      return;
    }
    setSaving(true);
    try {
      await accountApi.updatePreferences({
        country: settings.country?.trim() || null,
        timezone: settings.timezone?.trim() || null,
        dawPreference: settings.daw_preference?.trim() || null,
        pluginPreference: settings.plugin_preference?.trim() || null,
        theme: settings.theme ?? "system",
        language: settings.language?.trim() || "en",
        defaultBpm: Number(settings.default_bpm ?? 120),
        defaultKey: settings.default_key?.trim() || "",
        defaultGenre: settings.default_genre?.trim() || null,
        autoSave: Boolean(settings.auto_save),
        autosaveIntervalSeconds: Number(settings.autosave_interval_seconds ?? 60),
        promptHistoryEnabled: Boolean(settings.prompt_history_enabled),
        notificationSettings: settings.notification_settings ?? {},
      });
      toast.success("Settings updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function toggleNotification(key: string) {
    setSettings((current) => ({
      ...current,
      notification_settings: {
        ...(current.notification_settings ?? {}),
        [key]: !(current.notification_settings ?? {})[key],
      },
    }));
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-violet-300">Workspace</p>
          <h1 className="text-3xl font-black tracking-tight">Settings</h1>
          <p className="mt-2 max-w-2xl text-[#aaa3bd]">Control your creative defaults, storage behavior, and account notification preferences.</p>
        </header>

        {loading ? <div className="glass flex items-center gap-3 rounded-2xl p-6 text-[#c8c2d6]"><Loader2 className="size-4 animate-spin" />Loading settings…</div> : null}

        {!loading ? (
          <div className="grid gap-6">
            <section className="glass rounded-2xl p-6">
              <h2 className="text-lg font-bold">Creative defaults</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm font-medium">
                  Default BPM
                  <input type="number" min={40} max={240} value={settings.default_bpm ?? 120} onChange={(event) => setSettings((current) => ({ ...current, default_bpm: Number(event.target.value) }))} className="field mt-2" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium">
                  Default key
                  <input value={settings.default_key ?? ""} onChange={(event) => setSettings((current) => ({ ...current, default_key: event.target.value }))} className="field mt-2" placeholder="A minor" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium">
                  Default genre
                  <input value={settings.default_genre ?? ""} onChange={(event) => setSettings((current) => ({ ...current, default_genre: event.target.value }))} className="field mt-2" placeholder="Melodic trap" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium">
                  Preferred DAW
                  <input value={settings.daw_preference ?? ""} onChange={(event) => setSettings((current) => ({ ...current, daw_preference: event.target.value }))} className="field mt-2" placeholder="FL Studio" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium">
                  Preferred plugin family
                  <input value={settings.plugin_preference ?? ""} onChange={(event) => setSettings((current) => ({ ...current, plugin_preference: event.target.value }))} className="field mt-2" placeholder="Pianos, synth leads, pads" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium">
                  Language
                  <input value={settings.language ?? "en"} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value }))} className="field mt-2" disabled={!isAuthenticated} />
                </label>
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <h2 className="text-lg font-bold">Workspace behavior</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm font-medium">
                  Country
                  <input value={settings.country ?? ""} onChange={(event) => setSettings((current) => ({ ...current, country: event.target.value }))} className="field mt-2" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium">
                  Timezone
                  <input value={settings.timezone ?? ""} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} className="field mt-2" placeholder="America/New_York" disabled={!isAuthenticated} />
                </label>
                <label className="block text-sm font-medium">
                  Theme
                  <select value={settings.theme ?? "system"} onChange={(event) => setSettings((current) => ({ ...current, theme: event.target.value as "dark" | "system" }))} className="field mt-2" disabled={!isAuthenticated}>
                    <option value="system">System</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Autosave interval (seconds)
                  <input type="number" min={10} max={600} value={settings.autosave_interval_seconds ?? 60} onChange={(event) => setSettings((current) => ({ ...current, autosave_interval_seconds: Number(event.target.value) }))} className="field mt-2" disabled={!isAuthenticated} />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <input type="checkbox" checked={Boolean(settings.auto_save)} onChange={(event) => setSettings((current) => ({ ...current, auto_save: event.target.checked }))} className="mt-1" disabled={!isAuthenticated} />
                  <span>
                    <span className="block font-semibold text-white">Enable autosave</span>
                    <span className="mt-1 block text-sm text-[#aaa3bd]">Persist project notes and workspace changes automatically.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <input type="checkbox" checked={Boolean(settings.prompt_history_enabled)} onChange={(event) => setSettings((current) => ({ ...current, prompt_history_enabled: event.target.checked }))} className="mt-1" disabled={!isAuthenticated} />
                  <span>
                    <span className="block font-semibold text-white">Store prompt history</span>
                    <span className="mt-1 block text-sm text-[#aaa3bd]">Keep generation prompts available for revision and reuse.</span>
                  </span>
                </label>
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <h2 className="text-lg font-bold">Notifications</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  ["productUpdates", "Product updates", "Release notes, workflow changes, and important platform improvements."],
                  ["billing", "Billing alerts", "Trial expiry, Pro Pass renewals, and payment events."],
                  ["support", "Support updates", "Replies and status changes on your tickets."],
                ].map(([key, title, description]) => (
                  <label key={key} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                    <input type="checkbox" checked={Boolean((settings.notification_settings ?? {})[key])} onChange={() => toggleNotification(key)} className="mt-1" disabled={!isAuthenticated} />
                    <span>
                      <span className="block font-semibold text-white">{title}</span>
                      <span className="mt-1 block text-sm text-[#aaa3bd]">{description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <button type="button" onClick={() => void saveSettings()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold disabled:opacity-60">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isAuthenticated ? "Save settings" : "Sign in to save settings"}
            </button>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}