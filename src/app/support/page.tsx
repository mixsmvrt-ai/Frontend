"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Bug, Lightbulb, Loader2, Send } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicNavbar } from "@/components/public-navbar";
import { supabase } from "@/lib/supabase/browser";
import { supportApi, type SupportTicket } from "@/services/support";

const cards = [
  ["Knowledge Base", "Guides for generating, exporting, and organizing MIDI.", BookOpen],
  ["Bug Report", "Report an unexpected behavior with clear reproduction steps.", Bug],
  ["Feature Request", "Share a workflow that would make MidiFlow faster or more musical.", Lightbulb],
] as const;

export default function SupportPage() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("General question");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!supabase) {
      setLoadingTickets(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setSignedIn(Boolean(user));
      setEmail(user?.email ?? "");
      if (!user) {
        setLoadingTickets(false);
        return;
      }
      supportApi
        .list()
        .then((result) => setTickets(result.data))
        .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load support history."))
        .finally(() => setLoadingTickets(false));
    });
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!signedIn) {
      toast.error("Sign in to create a support ticket.");
      window.location.href = `/login?redirectTo=${encodeURIComponent("/support")}`;
      return;
    }

    if (message.trim().length < 10) {
      toast.error("Please include enough detail for the support team.");
      return;
    }

    setBusy(true);
    try {
      const result = await supportApi.create({
        subject: subject.trim() || topic,
        message,
        priority: topic === "Bug report" ? "high" : "normal",
      });
      setTickets((current) => [result.data, ...current]);
      setSubject("");
      setMessage("");
      toast.success("Support ticket created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create support ticket.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,.14),_transparent_28%),linear-gradient(180deg,_#070713,_#0a0916_35%,_#05050b)]">
      <PublicNavbar />
      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <p className="text-sm font-semibold tracking-[.22em] text-fuchsia-300">SUPPORT</p>
        <h1 className="mt-4 text-5xl font-black tracking-[-.05em] text-white">Get help without leaving your flow.</h1>
        <p className="mt-5 max-w-2xl text-lg text-[#b6afc9]">Use the knowledge base for quick answers, or open a real support ticket tied to your account so the team can follow up inside MidiFlow.</p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {cards.map(([title, copy, Icon]) => (
              <article className="glass rounded-2xl p-5" key={title}>
                <Icon className="size-6 text-fuchsia-400" />
                <h2 className="mt-5 font-semibold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#a4a0b2]">{copy}</p>
              </article>
            ))}
          </div>

          <form onSubmit={(event) => void submit(event)} className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">Contact support</h2>
            <p className="mt-2 text-sm text-[#a4a0b2]">Signed-in users can create tracked tickets. Replies from your support history stay attached to your account.</p>
            <label className="mt-6 block text-sm font-medium text-white">
              Topic
              <select value={topic} onChange={(event) => setTopic(event.target.value)} className="field mt-2">
                <option>General question</option>
                <option>Bug report</option>
                <option>Feature request</option>
                <option>Billing issue</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-white">
              Email
              <input className="field mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={signedIn} required />
            </label>
            <label className="mt-4 block text-sm font-medium text-white">
              Subject
              <input className="field mt-2" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short description of the issue" required />
            </label>
            <label className="mt-4 block text-sm font-medium text-white">
              Message
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="field mt-2 min-h-40" placeholder="Tell us what happened, what you expected, and any project or generation involved." required />
            </label>
            {!signedIn ? <p className="mt-4 text-sm text-[#b8b1ca]">You will be asked to sign in before the ticket is created.</p> : null}
            <button type="submit" disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {busy ? "Creating ticket" : "Create support ticket"}
            </button>
          </form>
        </div>

        <section className="mt-14 glass rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[.18em] text-fuchsia-300">RECENT TICKETS</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Your support history</h2>
            </div>
            {!signedIn ? <Link href="/login?redirectTo=%2Fsupport" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white">Sign in</Link> : null}
          </div>
          {loadingTickets ? <div className="mt-6 flex items-center gap-3 text-sm text-[#b6afc9]"><Loader2 className="size-4 animate-spin" />Loading support history…</div> : null}
          {!loadingTickets && signedIn && tickets.length === 0 ? <p className="mt-6 text-sm text-[#b6afc9]">No tickets yet. Your first request will appear here.</p> : null}
          {!loadingTickets && !signedIn ? <p className="mt-6 text-sm text-[#b6afc9]">Support history is available after sign-in.</p> : null}
          {!loadingTickets && tickets.length > 0 ? <div className="mt-6 grid gap-4">{tickets.slice(0, 6).map((ticket) => <article key={ticket.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-white">{ticket.subject}</h3><span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[.16em] text-[#c7c1d8]">{ticket.status}</span><span className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs uppercase tracking-[.16em] text-fuchsia-200">{ticket.priority}</span></div><p className="mt-3 text-sm text-[#b3adc6]">{ticket.support_messages?.[0]?.body ?? "No message preview available."}</p><p className="mt-3 text-xs text-[#8f88a6]">Updated {new Date(ticket.updated_at).toLocaleString()}</p></article>)}</div> : null}
        </section>
      </section>
      <PublicFooter />
    </main>
  );
}
