"use client";

import { AppShell } from "@/components/app-shell";
import { GenerationComposer } from "@/features/generation/generation-composer";

export default function DashboardPage() {
  return (
    <AppShell>
      <section className="flex min-h-[calc(100dvh-2.5rem)] flex-col justify-end bg-[#090909] px-1 pb-1 md:min-h-[calc(100dvh-4rem)] md:px-8 md:pb-8">
        <div className="mx-auto w-full max-w-4xl">
          <GenerationComposer />
        </div>
      </section>
    </AppShell>
  );
}
