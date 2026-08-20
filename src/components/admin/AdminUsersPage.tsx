"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, ShieldCheck, UserRound } from "lucide-react";
import { getAdminUsers, runAdminUserAction, updateAdminUser, type AdminMembershipStatus, type AdminMembershipType, type AdminRole, type AdminUser } from "@/services/admin";

type UserDraft = {
  membershipType: AdminMembershipType;
  membershipStatus: AdminMembershipStatus;
  role: AdminRole;
  plan: "go" | "plus";
};

const membershipTypes: Array<{ value: AdminMembershipType; label: string }> = [
  { value: "trial", label: "Trial" },
  { value: "pro", label: "Pro" },
  { value: "expired", label: "Expired" },
  { value: "admin", label: "Admin" },
];

const membershipStatuses: Array<{ value: AdminMembershipStatus; label: string }> = [
  { value: "trial_active", label: "Trial active" },
  { value: "pro_active", label: "Pro active" },
  { value: "expired", label: "Expired" },
  { value: "admin", label: "Admin" },
];

const roles: Array<{ value: AdminRole; label: string }> = [
  { value: "user", label: "User" },
  { value: "support", label: "Support" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];

function selectValue<T extends string>(value: string | null | undefined, allowed: T[], fallback: T) {
  return allowed.includes(value as T) ? value as T : fallback;
}

function draftFor(user: AdminUser): UserDraft {
  return {
    membershipType: selectValue(user.membership_type, membershipTypes.map((item) => item.value), "trial"),
    membershipStatus: selectValue(user.membership_status, membershipStatuses.map((item) => item.value), "expired"),
    role: selectValue(user.user_roles?.[0]?.role, roles.map((item) => item.value), "user"),
    plan: user.plan === "go" ? "go" : "plus",
  };
}

function labelFor(value: string | null | undefined) {
  return String(value ?? "-").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async (search = query) => {
    setLoading(true);
    try {
      const result = await getAdminUsers(search);
      setUsers(result.data);
      setDrafts(Object.fromEntries(result.data.map((user) => [user.id, draftFor(user)])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void getAdminUsers("").then((result) => {
      setUsers(result.data);
      setDrafts(Object.fromEntries(result.data.map((user) => [user.id, draftFor(user)])));
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Unable to load users.");
    }).finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => users.filter((user) => `${user.display_name ?? ""} ${user.id}`.toLowerCase().includes(query.toLowerCase())), [query, users]);

  const updateDraft = (id: string, field: keyof UserDraft, value: string) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } as UserDraft }));
  };

  const save = async (user: AdminUser) => {
    const draft = drafts[user.id];
    if (!draft) return;
    setSaving(user.id);
    setMessage("");
    try {
      await updateAdminUser(user.id, { membershipType: draft.membershipType, membershipStatus: draft.membershipStatus, role: draft.role });
      await runAdminUserAction(user.id, { action: "plan", plan: draft.plan });
      setMessage(`${user.display_name ?? "User"} updated.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setSaving(null);
    }
  };

  const runAction = async (user: AdminUser, action: "ban" | "unban") => {
    setSaving(user.id);
    try {
      await runAdminUserAction(user.id, action === "ban" ? { action, banDays: 30 } : { action });
      setMessage(`${user.display_name ?? "User"} ${action === "ban" ? "banned" : "unbanned"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete action.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-xs font-medium text-violet-400">Workspace management</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Users</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Manage membership, access, plans, and administrative roles with controlled selections.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-white/[.08] bg-white/[.03] px-4 py-3"><strong className="block text-lg text-white">{users.length}</strong><span className="text-slate-500">Loaded</span></div>
          <div className="rounded-lg border border-white/[.08] bg-white/[.03] px-4 py-3"><strong className="block text-lg text-emerald-300">{users.filter((user) => user.membership_status?.includes("active")).length}</strong><span className="text-slate-500">Active</span></div>
          <div className="rounded-lg border border-white/[.08] bg-white/[.03] px-4 py-3"><strong className="block text-lg text-amber-300">{users.filter((user) => user.membership_status?.includes("trial")).length}</strong><span className="text-slate-500">Trial</span></div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-white/[.08] bg-white/[.02] px-3 sm:max-w-md">
          <Search size={14} className="text-slate-600" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600" />
        </label>
        {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      </div>

      <section className="overflow-hidden rounded-xl border border-white/[.07] bg-[#181822]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left">
            <thead className="bg-[#211b2f] text-[10px] uppercase tracking-[.12em] text-slate-600"><tr><th className="px-5 py-3">User</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Membership</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Access</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin" size={18} />Loading users</td></tr> : filteredUsers.map((user) => {
              const draft = drafts[user.id] ?? draftFor(user);
              return <tr key={user.id} className="border-t border-white/[.05] align-middle hover:bg-white/[.025]">
                <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-violet-500/15 text-violet-300"><UserRound size={15} /></span><div><p className="text-xs font-medium text-slate-200">{user.display_name ?? "Unnamed user"}</p><p className="mt-1 max-w-40 truncate text-[10px] text-slate-600">{user.id}</p></div></div></td>
                <td className="px-3 py-4"><select value={draft.plan} onChange={(event) => updateDraft(user.id, "plan", event.target.value)} className="admin-select"><option value="go">Go</option><option value="plus">Plus</option></select></td>
                <td className="px-3 py-4"><select value={draft.membershipType} onChange={(event) => updateDraft(user.id, "membershipType", event.target.value)} className="admin-select">{membershipTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td>
                <td className="px-3 py-4"><select value={draft.membershipStatus} onChange={(event) => updateDraft(user.id, "membershipStatus", event.target.value)} className="admin-select">{membershipStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td>
                <td className="px-3 py-4"><select value={draft.role} onChange={(event) => updateDraft(user.id, "role", event.target.value)} className="admin-select">{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td>
                <td className="px-3 py-4 text-xs text-slate-500">{labelFor(user.membership_status)}</td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" disabled={saving === user.id} onClick={() => void save(user)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"><Check size={13} />{saving === user.id ? "Saving" : "Save"}</button><button type="button" disabled={saving === user.id} onClick={() => void runAction(user, "ban")} className="rounded-lg border border-red-400/20 px-3 py-2 text-[11px] font-semibold text-red-200 disabled:opacity-50">Ban</button><button type="button" disabled={saving === user.id} onClick={() => void runAction(user, "unban")} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-[11px] font-semibold text-emerald-200 disabled:opacity-50"><ShieldCheck size={13} /></button></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!loading && filteredUsers.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">No users match this search.</p> : null}
      </section>
    </div>
  );
}