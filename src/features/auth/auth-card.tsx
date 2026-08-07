"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { captureReferralFromUrl, getStoredReferral, signupReferralMetadata } from "@/services/referrals";

const discoveryOptions = ["Google or another search engine", "YouTube", "Instagram or TikTok", "A friend or colleague", "Discord or another community", "A music producer or creator", "Other"];

export function AuthCard({ mode }: { mode: "login" | "signup" | "forgot" | "reset" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [creatorRole, setCreatorRole] = useState("");
  const [discoverySource, setDiscoverySource] = useState("");
  const [discoveryOther, setDiscoveryOther] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const query = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const nextPath = query?.get("next") ?? query?.get("redirectTo") ?? "/create";

  useEffect(() => {
    if (!supabase || (mode !== "login" && mode !== "signup")) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace(nextPath);
      }
    });
  }, [mode, nextPath, router]);

  useEffect(() => {
    if (mode !== "signup") return;
    const existing = getStoredReferral();
    if (existing?.code) setReferralCode(existing.code);
    if (typeof window === "undefined") return;
    void captureReferralFromUrl(window.location.search, window.location.pathname).then((code) => {
      if (code) setReferralCode(code);
    });
  }, [mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return toast.error("Supabase is not configured for this deployment.");
    if (!email.includes("@")) return toast.error("Enter a valid email address.");
    if ((mode === "login" || mode === "signup" || mode === "reset") && password.length < 8) return toast.error("Use at least 8 characters for your password.");
    if (mode === "signup" && (!firstName.trim() || !lastName.trim())) return toast.error("Enter your first and last name.");
    if (mode === "signup" && !discoverySource) return toast.error("Tell us how you heard about MidiFlow.");
    if (mode === "signup" && discoverySource === "Other" && !discoveryOther.trim()) return toast.error("Tell us how you heard about MidiFlow.");

    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: redirectTo,
                data: {
                  first_name: firstName.trim(),
                  last_name: lastName.trim(),
                  creator_role: creatorRole || null,
                  discovery_source: discoverySource,
                  discovery_other: discoverySource === "Other" ? discoveryOther.trim() : null,
                  ...signupReferralMetadata(),
                },
              },
            })
          : mode === "forgot"
            ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
            : await supabase.auth.updateUser({ password });
      if (result.error) return toast.error(result.error.message);
      toast.success(mode === "forgot" ? "Reset instructions sent." : mode === "signup" ? "Account created. Check your inbox to verify your email." : mode === "reset" ? "Password updated." : "Logged in successfully.");
      if (mode === "login") router.replace(nextPath);
      if (mode === "signup") router.replace(nextPath);
      if (mode === "reset") router.replace("/login");
    } finally {
      setBusy(false);
    }
  };
  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Create your studio" : mode === "forgot" ? "Reset your password" : "Choose a new password";
  const isSignup = mode === "signup";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-5 py-10">
      <div aria-hidden="true" className="absolute -left-32 top-12 size-96 rounded-full bg-violet-600/15 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-20 right-0 size-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <form onSubmit={submit} className={`glass relative w-full rounded-3xl border border-white/10 p-7 shadow-2xl shadow-violet-950/30 sm:p-9 ${isSignup ? "max-w-2xl" : "max-w-md"}`}>
        <Link href="/" className="text-sm font-black text-violet-200">← MidiFlow</Link>
        <h1 className="mt-7 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#aaa3bd]">{mode === "forgot" ? "We will send a secure password recovery link." : isSignup ? "Set up your creative workspace in a few moments." : "Create and shape the music in your head."}</p>

        {isSignup && (
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required className="field mt-2" autoComplete="given-name" /></label>
            <label className="block text-sm font-medium">Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} required className="field mt-2" autoComplete="family-name" /></label>
            <label className="block text-sm font-medium sm:col-span-2">What best describes you?
              <select value={creatorRole} onChange={(event) => setCreatorRole(event.target.value)} className="field mt-2">
                <option value="">Select an option (optional)</option>
                <option>Producer</option><option>Songwriter</option><option>Artist</option><option>DJ</option><option>Composer</option><option>Music student</option><option>Music enthusiast</option>
              </select>
            </label>
          </div>
        )}

        {isSignup && referralCode ? (
          <div className="mt-4 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4 text-sm text-violet-100">
            Referral applied: <span className="font-bold tracking-[.12em]">{referralCode}</span>
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-medium">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="field mt-2" autoComplete="email" /></label>
        {mode !== "forgot" && <label className="mt-4 block text-sm font-medium">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={8} className="field mt-2" autoComplete={mode === "login" ? "current-password" : "new-password"} /><span className="mt-2 block text-xs font-normal text-[#8f8ca0]">Use at least 8 characters.</span></label>}

        {isSignup && (
          <div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
            <label className="block text-sm font-medium">How did you hear about us?
              <select value={discoverySource} onChange={(event) => setDiscoverySource(event.target.value)} required className="field mt-2">
                <option value="">Choose an option</option>
                {discoveryOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            {discoverySource === "Other" && <label className="mt-4 block text-sm font-medium">How did you hear about us?<input value={discoveryOther} onChange={(event) => setDiscoveryOther(event.target.value)} required className="field mt-2" placeholder="Tell us where you found MidiFlow" /></label>}
          </div>
        )}

        <button disabled={busy} className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 text-sm font-bold shadow-[0_10px_30px_rgba(139,92,246,.28)] transition hover:brightness-110 disabled:opacity-60">{busy ? "Working..." : mode === "login" ? "Login" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}</button>
        {mode === "login" && <p className="mt-4 text-center text-sm text-[#aaa3bd]"><Link href="/forgot-password" className="text-violet-200">Forgot password?</Link> · <Link href="/signup" className="text-violet-200">Create account</Link></p>}
      </form>
    </main>
  );
}
