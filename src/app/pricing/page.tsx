import Link from "next/link";
import { Check } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicNavbar } from "@/components/public-navbar";

const plans = [
  {
    name: "Go",
    price: "$5.99",
    detail: "The essentials for making ideas quickly",
    features: [
      "1,500 shared monthly credits across Text to MIDI, Voice to MIDI, and Song Pack Generator",
      "Text to MIDI generation",
      "Projects and MIDI downloads",
      "Basic support",
    ],
    href: "/upgrade?plan=go",
  },
  {
    name: "Plus",
    price: "$19.99",
    detail: "The complete MidiFlow studio",
    features: [
      "3,000 shared monthly credits across Text to MIDI, Voice to MIDI, and Song Pack Generator",
      "Everything in Go",
      "Voice to MIDI and Song Pack Generator",
      "Fast support",
    ],
    featured: true,
    href: "/upgrade?plan=plus",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black">
      <PublicNavbar />
      <section className="mx-auto max-w-7xl px-5 py-20 text-center lg:px-8">
        <p className="text-sm font-semibold text-violet-300">SIMPLE, FLEXIBLE ACCESS</p>
        <h1 className="mt-4 text-5xl font-bold tracking-[-.05em] sm:text-6xl">Choose your creative pace.</h1>
        <p className="mx-auto mt-5 max-w-xl text-[#aaa6b8]">Choose the workspace that fits your creative pace. Upgrade whenever you need more tools and faster support.</p>
        <div className="mx-auto mt-14 grid max-w-4xl gap-5 lg:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative rounded-2xl border p-7 text-left ${plan.featured ? "border-violet-400 bg-violet-500/10 shadow-[0_0_50px_rgba(117,70,255,.15)]" : "border-white/10 bg-white/[.025]"}`}>
              {plan.featured ? <span className="absolute right-5 top-5 rounded-full bg-violet-500 px-3 py-1 text-xs font-bold">Most popular</span> : null}
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-2 text-sm text-[#aaa6b8]">{plan.detail}</p>
              <p className="mt-7 text-4xl font-bold">{plan.price}{plan.name === "30-Day Pro Pass" ? <span className="ml-1 text-sm font-normal text-[#9995a8]">/30 days</span> : null}</p>
              <Link href={plan.href} className={`mt-7 block rounded-xl py-3 text-center text-sm font-semibold ${plan.featured ? "bg-violet-500" : "bg-white/10 hover:bg-white/15"}`}>Choose {plan.name}</Link>
              <ul className="mt-7 space-y-3">
                {plan.features.map((feature) => (
                  <li className="flex gap-2 text-sm text-[#ccc8d5]" key={feature}>
                    <Check className="size-4 shrink-0 text-violet-300" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <section className="mt-20 overflow-hidden rounded-2xl border border-white/10 text-left">
          <h2 className="border-b border-white/10 p-6 text-2xl font-semibold">Compare access</h2>
          <div className="grid gap-px bg-white/10 sm:grid-cols-3">
            <div className="bg-[#0f0e19] p-6">
              <p className="text-sm font-semibold text-violet-300">Trial</p>
              <p className="mt-2 text-sm text-[#c9c4d8]">Text to MIDI, projects, downloads, and basic support.</p>
            </div>
            <div className="bg-[#0f0e19] p-6">
              <p className="text-sm font-semibold text-violet-300">Expired</p>
              <p className="mt-2 text-sm text-[#c9c4d8]">Voice to MIDI, Song Pack Generator, and fast support.</p>
            </div>
            <div className="bg-[#0f0e19] p-6">
              <p className="text-sm font-semibold text-violet-300">Pro Pass</p>
              <p className="mt-2 text-sm text-[#c9c4d8]">Both plans include saved projects and MIDI downloads. Plans can be changed as your needs grow.</p>
            </div>
          </div>
        </section>
      </section>
      <PublicFooter />
    </main>
  );
}
