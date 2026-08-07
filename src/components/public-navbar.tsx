"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/support", label: "Support" },
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const listener = () => setScrolled(window.scrollY > 12);
    listener();
    window.addEventListener("scroll", listener, { passive: true });

    return () => window.removeEventListener("scroll", listener);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition ${scrolled ? "border-white/10 bg-black/85 backdrop-blur-xl" : "border-white/[.055] bg-black/70 backdrop-blur-md"}`}
    >
    <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-xl font-bold tracking-tight"
        onClick={() => setOpen(false)}
      >
        <AudioLines className="size-6 text-fuchsia-500" />
        MidiFlow
      </Link>
      <div className="hidden items-center gap-1 lg:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm text-[#bcb9c9] transition hover:bg-white/5 hover:text-white">
            {link.label}
          </Link>
        ))}
      </div>
      <div className="hidden items-center gap-2 lg:flex">
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-[#ccc9d6] hover:text-white">Log in</Link>
        <Link href="/signup" className="rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 px-5 py-2.5 text-sm font-medium shadow-[0_4px_18px_rgba(112,57,255,.38)]">Sign up</Link>
      </div>
      <button
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="grid size-10 place-items-center rounded-lg bg-white/5 text-white lg:hidden"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
    </nav>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden border-t border-white/10 bg-[#0b0a18] lg:hidden"
        >
          <div className="flex flex-col gap-1 px-5 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm text-[#cbc8d5] hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 py-2.5 text-center text-sm">Log in</Link>
              <Link href="/signup" onClick={() => setOpen(false)} className="rounded-lg bg-violet-600 py-2.5 text-center text-sm font-medium">Sign up</Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </header>
  );
}
