"use client";

import { ArrowRight, BrainCircuit, CalendarDays, Check, Download, FolderOpen, Gift, Infinity, Layers3, Mic2, Sparkles, X, Zap } from "lucide-react";

const perks = [
  { icon: Infinity, title: "Unlimited MIDI Generations", detail: "Create as many MIDI ideas as you want" },
  { icon: Mic2, title: "Voice to MIDI", detail: "Transform your voice into melodies" },
  { icon: FolderOpen, title: "Access to All MIDI Packs", detail: "Use the reference MIDI library" },
  { icon: Layers3, title: "Song Pack Generator", detail: "Generate full song packs instantly" },
  { icon: BrainCircuit, title: "Music Brain (AI Assistant)", detail: "Get help with chords, melodies, and more" },
  { icon: Download, title: "High Quality Export", detail: "Export in high quality MIDI files" },
];

const confetti = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37) % 100}%`, top: `${(index * 53) % 100}%`, delay: `${(index % 7) * -0.7}s`, duration: `${4.5 + (index % 5) * 0.8}s`, color: ["#8b5cf6", "#d946ef", "#f4b942", "#5eead4"][index % 4], rotate: `${(index * 31) % 160 - 80}deg`,
}));

export function TrialWelcomeModal({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[#03030a]/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="trial-welcome-title">
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[#080916] shadow-[0_30px_120px_rgba(95,31,180,.35)]">
        <button type="button" onClick={onClose} aria-label="Close trial welcome" className="absolute right-4 top-4 z-20 grid size-9 place-items-center rounded-full bg-white/[.08] text-white transition hover:bg-white/[.16]"><X className="size-5" /></button>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-1/4 top-1/3 size-56 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 size-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
          {confetti.map((piece, index) => <span key={index} className="trial-confetti absolute block size-2 rounded-[2px]" style={{ left: piece.left, top: piece.top, backgroundColor: piece.color, animationDelay: piece.delay, animationDuration: piece.duration, transform: `rotate(${piece.rotate})` }} />)}
        </div>
        <div className="relative grid md:grid-cols-[1fr_1.08fr]">
          <div className="flex min-h-[520px] flex-col items-center justify-center px-7 py-12 text-center sm:px-14">
            <div className="relative mb-9 grid size-48 place-items-center sm:size-56"><div className="absolute inset-6 rounded-full bg-violet-500/25 blur-2xl" /><div className="relative grid size-32 place-items-center rounded-xl border border-violet-300/25 bg-gradient-to-br from-violet-600 to-fuchsia-700 shadow-[0_20px_45px_rgba(124,58,237,.5)] sm:size-40"><Gift className="size-16 text-white sm:size-20" /></div><Sparkles className="absolute right-3 top-1 size-7 text-fuchsia-300" /><Sparkles className="absolute bottom-4 left-2 size-6 text-amber-300" /></div>
            <h1 id="trial-welcome-title" className="text-4xl font-black tracking-tight text-white sm:text-5xl">Congratulations! <span aria-hidden="true">🎉</span></h1><p className="mt-3 text-lg text-[#aaa6b8]">Welcome to MidiFlow</p><p className="mt-10 text-sm text-[#aaa6b8]">You&apos;ve unlocked</p><p className="mt-1 text-3xl font-black tracking-wide text-white"><span className="text-violet-400">7 DAYS</span> FREE TRIAL</p><p className="mt-3 text-sm text-[#aaa6b8]">Explore. Create. Inspire.</p>
          </div>
          <div className="border-t border-white/[.08] px-6 py-9 sm:px-10 md:border-l md:border-t-0 md:py-12">
            <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 size-6 text-fuchsia-400" /><div><h2 className="text-xl font-bold text-white">Your 7-Day Free Trial</h2><p className="mt-1 text-sm leading-6 text-[#aaa6b8]">You now have full access to MidiFlow Premium features for the next <span className="font-semibold text-fuchsia-400">7 days</span>.</p></div></div><div className="my-6 h-px bg-white/[.08]" /><h3 className="flex items-center gap-2 text-base font-bold text-fuchsia-400"><Sparkles className="size-5" />Your Premium Perks</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">{perks.map(({ icon: Icon, title, detail }) => <div key={title} className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[.08] bg-white/[.05] text-violet-300"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{title}</p><p className="mt-0.5 text-xs leading-5 text-[#8f8b9d]">{detail}</p></div><Check className="mt-1 size-5 shrink-0 text-violet-400" /></div>)}</div>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/[.08] bg-white/[.04] p-3 text-xs text-[#aaa6b8]"><Zap className="mt-0.5 size-4 shrink-0 text-amber-300" /><p>No card required. No commitment.<br /><span className="text-fuchsia-400">Cancel anytime.</span></p></div>
          </div>
        </div>
        <div className="relative border-t border-white/[.08] px-6 pb-5 pt-4 sm:px-10"><button type="button" onClick={onStart} className="flex w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(124,58,237,.35)] transition hover:brightness-110">Start Creating Now <ArrowRight className="size-5" /></button><p className="mt-3 text-center text-xs text-[#817d91]">Your trial will end in 7 days. We&apos;ll remind you before it ends. <span className="text-fuchsia-400">♥</span></p></div>
      </div>
    </div>
  );
}