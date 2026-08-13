"use client";

import { useEffect, useState } from "react";
import { Activity, CreditCard, Database, Headphones, Music2, Sparkles, TrendingUp, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAdminOverview, getAdminResource, type AdminOverview } from "@/services/admin";
import ChartCard from "./ChartCard";
import MetricCard from "./MetricCard";

const fallbackSeries = [{ name: "Day 1", value: 24, secondary: 18 }, { name: "Day 2", value: 38, secondary: 22 }, { name: "Day 3", value: 31, secondary: 28 }, { name: "Day 4", value: 52, secondary: 34 }, { name: "Day 5", value: 46, secondary: 39 }, { name: "Day 6", value: 64, secondary: 48 }, { name: "Day 7", value: 58, secondary: 51 }];
const tooltipStyle = { backgroundColor: "#1b1b26", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#e2e8f0", fontSize: 12 };

export default function DashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [generations, setGenerations] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    Promise.all([getAdminOverview(), getAdminResource("payments"), getAdminResource("generations")]).then(([overviewResponse, paymentsResponse, generationsResponse]) => {
      setOverview(overviewResponse.data);
      setPayments(paymentsResponse.data ?? []);
      setGenerations(generationsResponse.data ?? []);
    }).catch(() => undefined);
  }, []);

  const series = payments.length ? payments.slice(0, 7).reverse().map((payment, index) => ({ name: String(payment.created_at ?? `Day ${index + 1}`).slice(0, 10), value: Number(payment.amount_cents ?? 0), secondary: 0 })) : fallbackSeries;
  const generationSeries = generations.length ? generations.slice(0, 7).reverse().map((generation, index) => ({ name: String(generation.created_at ?? `Day ${index + 1}`).slice(0, 10), value: index + 1, secondary: Number(generation.credits_used ?? generation.credit_cost ?? 0) })) : fallbackSeries;
  const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  const live = overview;

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium text-violet-400">Live platform telemetry</p><h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Admin overview</h2><p className="mt-2 text-sm text-slate-500">Real-time health and activity across MidiFlow.</p></div><button className="flex w-fit items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-500"><Sparkles size={14} /> Create report</button></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 sm:gap-4"><MetricCard label="Total users" value={live ? live.totalUsers.toLocaleString() : "..."} change="Live" icon={Users} /><MetricCard label="Active users" value={live ? (live.totalUsers - live.expiredUsers).toLocaleString() : "..."} change="Live" icon={Activity} tone="blue" /><MetricCard label="Paid users" value={live ? live.proUsers.toLocaleString() : "..."} change="Live" icon={CreditCard} tone="green" /><MetricCard label="Revenue" value={live ? `$${(live.revenueCents / 100).toLocaleString()}` : "..."} change="Live" icon={TrendingUp} tone="amber" /><MetricCard label="Storage used" value={live ? formatBytes(live.storageBytes) : "..."} change="Live" icon={Database} /><MetricCard label="Generations" value={live ? live.totalGenerations.toLocaleString() : "..."} change="Live" icon={Music2} tone="blue" /></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]"><ChartCard title="Revenue overview" subtitle="Live payment records"><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="liveRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={.35} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="url(#liveRevenue)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div></ChartCard><ChartCard title="Generation activity" subtitle="Live generation records"><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={generationSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></ChartCard></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-3"><ChartCard title="Payment volume" subtitle="Recent live transactions"><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartCard><div className="rounded-xl border border-white/[0.07] bg-[#181822] p-5"><div className="flex items-center gap-2 text-xs text-slate-500"><Headphones size={15} className="text-violet-400" /> Open support tickets</div><p className="mt-5 text-3xl font-semibold text-white">{live ? live.openTickets.toLocaleString() : "..."}</p><p className="mt-2 text-xs text-slate-600">Live queue count</p></div><div className="rounded-xl border border-white/[0.07] bg-[#181822] p-5"><div className="flex items-center gap-2 text-xs text-slate-500"><Users size={15} className="text-blue-400" /> Trial users</div><p className="mt-5 text-3xl font-semibold text-white">{live ? live.trialUsers.toLocaleString() : "..."}</p><p className="mt-2 text-xs text-slate-600">Live membership status</p></div></div>
  </div>;
}
