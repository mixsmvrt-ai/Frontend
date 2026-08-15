"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Filter, MoreHorizontal, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import MetricCard from "./MetricCard";
import ChartCard from "./ChartCard";
import { getAdminResource, getAdminUsers } from "@/services/admin";

const colors = ["#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b"];
const tooltipStyle = { backgroundColor: "#1b1b26", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#e2e8f0", fontSize: 12 };

type Config = { title: string; description: string; tabs: string[]; metrics: Array<{ label: string; value: string; change: string; tone?: "violet" | "blue" | "green" | "amber" }>; columns: string[]; rows: string[][]; chartTitle: string; chartType?: "area" | "bar" | "pie"; action?: string; resource?: string };

const resourceByTitle: Record<string, string> = { Users: "users", Payments: "payments", Subscriptions: "payments", Projects: "projects", "MIDI Library": "midi-library", "AI Generation": "generations", Support: "supportTickets", Settings: "settings", "Music Brain": "artistProfiles", Referrals: "referrals" };
const formatCell = (value: unknown) => value === null || value === undefined || value === "" ? "-" : typeof value === "object" ? JSON.stringify(value) : String(value);
const fieldAliases: Record<string, string[]> = { Name: ["display_name", "name", "full_name", "email"], User: ["display_name", "user_name", "email", "user_id"], Customer: ["display_name", "customer_name", "email", "user_id"], Owner: ["display_name", "owner_name", "email", "user_id"], Profile: ["artist_name", "name"], "Pack name": ["name", "pack_name"], Project: ["name", "project_name"], Subject: ["subject", "title"], "Transaction ID": ["transaction_id", "payment_id", "id"], Generation: ["id"], Plan: ["membership_type", "plan", "plan_name"], Amount: ["amount_cents", "amount", "total_cents"], Method: ["payment_method", "method", "provider"], Category: ["category", "type"], Type: ["type", "project_type"], Genre: ["genre", "primary_genre"], Status: ["membership_status", "status", "active"], "Model used": ["model_used"], Fallback: ["used_fallback"], "Failure reason": ["error_message"], Created: ["created_at"], Date: ["created_at", "updated_at", "paid_at"], "Last updated": ["updated_at"], "Last active": ["last_active_at", "updated_at"], Credits: ["credits_balance", "credits_used", "credit_cost"], Referrals: ["referrals", "referral_count", "signups"], Rules: ["rules", "rule_count"], "MIDI count": ["midi_count", "file_count", "count"], Storage: ["storage_size", "size_bytes"], Requests: ["requests", "request_count"], Latency: ["latency_ms", "average_latency_ms"], Tokens: ["tokens", "total_tokens"], Assigned: ["assigned_to", "assignee"], Priority: ["priority"], Scope: ["scope"] };
const readableKeys = ["display_name", "name", "full_name", "artist_name", "title", "subject", "email", "status", "membership_status", "membership_type", "type", "category", "genre", "amount_cents", "amount", "count", "created_at", "updated_at"];

export default function SectionPage({ config }: { config: Config }) {
  const [tab, setTab] = useState(config.tabs[0]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const resource = config.resource ?? resourceByTitle[config.title];

  useEffect(() => {
    if (!resource) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const response = config.title === "Users" ? await getAdminUsers(query) : await getAdminResource(resource);
        const liveRecords = (response.data ?? []) as Array<Record<string, unknown>>;
        if (config.title !== "Users" && liveRecords.some((record) => record.user_id || record.owner_id || record.customer_id)) {
          const usersResponse = await getAdminUsers();
          const names = new Map(usersResponse.data.map((user) => [user.id, user.display_name ?? user.id]));
          setRecords(liveRecords.map((record) => ({ ...record, display_name: record.display_name ?? names.get(String(record.user_id ?? record.owner_id ?? record.customer_id)) })));
        } else {
          setRecords(liveRecords);
        }
      } catch {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [config.title, resource, query]);

  const valueForColumn = (record: Record<string, unknown>, column: string, index: number) => {
    const candidates = fieldAliases[column] ?? [column.toLowerCase().replaceAll(" ", "_")];
    const key = candidates.find((candidate) => record[candidate] !== undefined && record[candidate] !== null && record[candidate] !== "");
    if (key) {
      const value = record[key];
      if (key.endsWith("_cents") && typeof value === "number") return `$${(value / 100).toFixed(2)}`;
      if (key.endsWith("_bytes") && typeof value === "number") return `${(value / 1024 / 1024).toFixed(1)} MB`;
      if (["created_at", "updated_at", "last_active_at", "paid_at"].includes(key) && typeof value === "string") return new Date(value).toLocaleDateString();
      if (key === "used_fallback" && typeof value === "boolean") return value ? "Yes" : "No";
      if (key === "user_id" && typeof value === "string") return "Member";
      return formatCell(value);
    }
    const fallbackKey = readableKeys.find((candidate) => record[candidate] !== undefined && record[candidate] !== null && record[candidate] !== "");
    return fallbackKey && index === 0 ? formatCell(record[fallbackKey]) : "-";
  };

  const rows = records.map((record) => config.columns.map((column, index) => valueForColumn(record, column, index)));
  const visibleRows = rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()));
  const liveMetrics = records.length ? config.metrics.map((metric, index) => {
    const numericValues = records.flatMap((record) => Object.values(record).filter((value): value is number => typeof value === "number"));
    const statuses = records.map((record) => String(record.status ?? record.membership_status ?? "").toLowerCase());
    const value = index === 0 ? records.length.toLocaleString() : index === 1 ? statuses.filter((status) => status.includes("active") || status.includes("completed") || status.includes("ready")).length.toLocaleString() : index === 2 ? numericValues.reduce((sum, item) => sum + item, 0).toLocaleString() : statuses.filter((status) => status.includes("pending") || status.includes("trial")).length.toLocaleString();
    return { ...metric, value, change: "Live" };
  }) : config.metrics;
  const chartData = records.length ? records.slice(0, 7).reverse().map((record, index) => ({ name: valueForColumn(record, config.columns[0], 0), value: Object.values(record).find((value): value is number => typeof value === "number") ?? 1, secondary: index + 1 })) : [];
  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="mb-2 text-xs font-medium text-violet-400">Workspace management</p><h2 className="text-2xl font-semibold tracking-tight text-white">{config.title}</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">{config.description}</p></div><div className="flex gap-2"><button className="flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.04]"><Download size={14} /> Export</button><button className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-500"><Plus size={14} /> {config.action ?? "Add new"}</button></div></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">{liveMetrics.map((metric, index) => <MetricCard key={metric.label} {...metric} icon={[SlidersHorizontal, Filter, Download, Plus][index]} />)}</div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]"><ChartCard title={config.chartTitle} subtitle="Performance over the selected period"><div className="h-[245px]"><ResponsiveContainer width="100%" height="100%">{config.chartType === "bar" ? <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#8b5cf6" radius={[5, 5, 0, 0]} /></BarChart> : config.chartType === "pie" ? <PieChart><Pie data={[{ name: "Pro", value: 42 }, { name: "Trial", value: 31 }, { name: "Expired", value: 18 }, { name: "Other", value: 9 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={4}>{[0, 1, 2, 3].map((index) => <Cell key={index} fill={colors[index]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart> : <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="sectionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} fill="url(#sectionFill)" /></AreaChart>}</ResponsiveContainer></div></ChartCard><ChartCard title="Weekly comparison" subtitle="Current period versus previous"><div className="h-[245px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" name="Current" fill="#8b5cf6" radius={[4, 4, 0, 0]} /><Bar dataKey="secondary" name="Previous" fill="#334155" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartCard></div>
    <section className="mt-4 rounded-xl border border-white/[0.07] bg-[#181822] shadow-[0_18px_50px_rgba(0,0,0,.14)]"><div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain scrollbar-hidden">{config.tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition ${tab === item ? "bg-violet-500/15 text-violet-300" : "text-slate-500 hover:text-slate-200"}`}>{item}</button>)}</div><div className="flex shrink-0 gap-2"><label className="flex h-9 min-w-48 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3"><Search size={14} className="text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records..." className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600" /></label><button className="grid size-9 place-items-center rounded-lg border border-white/[0.08] text-slate-500 hover:text-slate-200" aria-label="Filter records"><Filter size={15} /></button></div></div><div className="max-h-[60vh] overflow-auto overscroll-contain scrollbar-hidden"><table className="w-full min-w-[760px] text-left"><thead className="sticky top-0 z-10 bg-[#211b2f]"><tr>{config.columns.map((column) => <th key={column} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{column}</th>)}<th className="px-5 py-3" /></tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t border-white/[0.05] transition hover:bg-white/[0.025]"><>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`px-5 py-4 text-xs ${cellIndex === 0 ? "font-medium text-slate-200" : "text-slate-500"}`}>{cellIndex === 0 && config.title === "Users" ? <span className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-violet-500/20 text-[10px] font-semibold text-violet-200">{cell.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>{cell}</span> : cell}</td>)}</><td className="px-5 py-4 text-right"><button onClick={() => setSelected(row)} className="rounded-md p-1.5 text-slate-600 hover:bg-white/[0.06] hover:text-slate-200" aria-label={`Open ${row[0]}`}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3 text-[11px] text-slate-600"><span>{loading ? "Loading live records..." : `Showing ${visibleRows.length} of ${rows.length} records`}</span><span>Live admin data</span></div></section>
    {selected && <><button className="fixed inset-0 z-40 bg-black/60" onClick={() => setSelected(null)} aria-label="Close detail drawer" /><aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-white/[0.08] bg-[#111118] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs text-violet-400">Record details</p><h3 className="mt-2 text-xl font-semibold text-white">{selected[0]}</h3></div><button onClick={() => setSelected(null)} className="grid size-8 place-items-center rounded-lg border border-white/[0.08] text-slate-500 hover:text-slate-200" aria-label="Close detail drawer"><X size={16} /></button></div><div className="mt-8 space-y-4">{config.columns.slice(1).map((column, index) => <div key={column} className="flex items-center justify-between border-b border-white/[0.06] pb-3"><span className="text-xs text-slate-600">{column}</span><span className="text-xs font-medium text-slate-200">{selected[index + 1] ?? "-"}</span></div>)}</div><div className="mt-8 grid grid-cols-2 gap-2"><button className="rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white">Open profile</button><button onClick={() => setSelected(null)} className="rounded-lg border border-white/[0.08] px-3 py-2.5 text-xs font-medium text-slate-300">Close</button></div></aside></>}
  </div>;
}
