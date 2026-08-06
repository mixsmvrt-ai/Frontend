import { Apple, MonitorDown } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicNavbar } from "@/components/public-navbar";

const platforms = [
  { name: "Windows", detail: "Windows 10 or newer · 64-bit", icon: MonitorDown },
  { name: "Apple", detail: "macOS 13 or newer · Apple silicon", icon: Apple },
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-[#070713]">
      <PublicNavbar />
      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <p className="text-sm font-semibold text-violet-300">DESKTOP APP</p>
        <h1 className="mt-4 text-5xl font-bold tracking-[-.05em] sm:text-6xl">MidiFlow on your computer.</h1>
        <p className="mt-5 max-w-2xl text-lg text-[#aaa6b8]">Desktop downloads for Windows and Apple are coming soon. Your projects and exports are already available in the web app.</p>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {platforms.map(({ name, detail, icon: Icon }) => (
            <article key={name} className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
              <Icon className="size-8 text-violet-300" />
              <h2 className="mt-8 text-xl font-semibold">{name}</h2>
              <p className="mt-2 text-sm text-[#9d99ac]">{detail}</p>
              <span className="mt-7 inline-flex rounded-lg border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm font-medium text-[#c9c4d8]">Coming soon</span>
            </article>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
