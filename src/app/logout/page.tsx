"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
export default function LogoutPage() { const router = useRouter(); useEffect(() => { async function run() { await supabase?.auth.signOut(); router.replace("/"); } void run(); }, [router]); return <main className="grid min-h-screen place-items-center bg-[#070713]"><section className="glass rounded-2xl p-8 text-center"><h1 className="text-2xl font-black">Signing you out…</h1><p className="mt-3 text-[#aaa3bd]">Your session is being cleared securely.</p><Link href="/" className="mt-5 inline-block text-violet-200">Return home</Link></section></main>; }
