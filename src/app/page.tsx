"use client";

import { AppShell } from "@/components/app-shell";
import { GenerationComposer } from "@/features/generation/generation-composer";

export default function Home() {
  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-4xl flex-col justify-center pb-36">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">New project</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Start a musical conversation.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#aaa3bd]">
          Your first prompt creates a project. Every follow-up inside that project keeps the earlier prompts and MIDI direction in context.
        </p>
        <div className="mt-10">
          <GenerationComposer />
        </div>
      </section>
    </AppShell>
  );
}
