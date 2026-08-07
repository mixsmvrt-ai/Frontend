"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing secure sign-in…");
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const code = search.get("code");
    const nextPath = search.get("next") ?? "/create";
    if (!supabase || !code) {
      setMessage("This verification link is invalid or Supabase is not configured.");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Your email has been verified. Redirecting to your workspace…");
      router.replace(nextPath);
    });
  }, [router]);

  return <main className="grid min-h-screen place-items-center bg-black p-5"><section className="glass max-w-md rounded-2xl p-8 text-center"><h1 className="text-2xl font-black">MidiFlow authentication</h1><p className="mt-3 text-[#aaa3bd]">{message}</p><Link href="/dashboard" className="mt-6 inline-block text-violet-200">Open workspace</Link></section></main>;
}
