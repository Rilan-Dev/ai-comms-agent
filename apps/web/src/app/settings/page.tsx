"use client";

import { useEffect, useState } from "react";
import { GmailOAuthSettings } from "./gmail-oauth-settings";
import { ZohoOAuthSettings } from "./zoho-oauth-settings";
import { AIRuntimeSettings } from "./ai-runtime-settings";

type Organization = { id: string; name: string; slug: string; status: string };
type Member = { id: string; role: string; status: string; user: { id: string; email: string; name: string | null; status: string } | null };

export default function SettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMember, setSavingMember] = useState("");
  const [notice, setNotice] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/settings/organization").then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.message ?? "Organization settings could not be loaded.");
        return body.organization as Organization;
      }),
      fetch("/api/settings/members").then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.message ?? "Members could not be loaded.");
        return body.members as Member[];
      }),
    ]).then(([org, memberList]) => {
      setOrganization(org);
      setMembers(memberList);
    }).catch((e) => {
      setError(e instanceof Error ? e.message : "Settings could not be loaded.");
    }).finally(() => setLoading(false));
  }, []);

  async function updateMember(membershipId: string, action: "role" | "status", value: string) {
    setSavingMember(membershipId);
    setNotice("");
    try {
      const response = await fetch("/api/settings/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ membershipId, action, [action === "role" ? "role" : "status"]: value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Membership update failed.");
      setMembers((current) => current.map((item) => item.id === membershipId ? { ...item, ...(body.membership ?? {}) } : item));
      setNotice("Membership updated.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Membership update failed.");
    } finally {
      setSavingMember("");
    }
  }


  async function changePassword() {
    if (newPassword !== confirmPassword) { setNotice("New passwords do not match."); return; }
    setChangingPassword(true); setNotice("");
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Password change failed.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setNotice("Password changed. All other sessions have been signed out.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Password change failed."); }
    finally { setChangingPassword(false); }
  }

  return (
    <main className="mx-auto max-w-[1100px] space-y-8 p-5 sm:p-7 lg:p-9">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Organization access and runtime posture. Sensitive configuration remains server-side.
        </p>
      </header>

      {error ? (
        <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Organization</p>
          {loading ? (
            <div className="mt-5 h-24 animate-pulse rounded-xl bg-muted" />
          ) : organization ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Value label="Name" value={organization.name} />
              <Value label="Slug" value={organization.slug} />
              <Value label="Status" value={organization.status} />
              <Value label="Organization ID" value={organization.id} mono />
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">No organization context is available.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Runtime posture</p>
          <div className="mt-5 space-y-3">
            <Status label="Provider credentials" value="Server-side only" />
            <Status label="Sensitive actions" value="Approval controlled" />
            <Status label="Tenant isolation" value="Organization scoped" />
            <Status label="Members" value={loading ? "Loading…" : String(members.length)} />
          </div>
        </div>
      </section>

      <GmailOAuthSettings organizationId={organization?.id ?? ""} />
      <ZohoOAuthSettings organizationId={organization?.id ?? ""} />
      <AIRuntimeSettings organizationId={organization?.id ?? ""} />

      <section className="rounded-2xl border bg-background p-5">
        {notice ? <div className="mb-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm">{notice}</div> : null}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Members & roles</p>
            <p className="mt-1 text-sm text-muted-foreground">Current organization membership state from PostgreSQL.</p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-[.12em] text-muted-foreground">
              <tr><th className="px-3 py-3 font-medium">Member</th><th className="px-3 py-3 font-medium">Role</th><th className="px-3 py-3 font-medium">Membership</th><th className="px-3 py-3 font-medium">User</th></tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b last:border-0">
                  <td className="px-3 py-3"><div className="font-medium">{member.user?.name || "Unnamed user"}</div><div className="text-xs text-muted-foreground">{member.user?.email || "Unknown email"}</div></td>
                  <td className="px-3 py-3">
                    {member.role === "owner" ? (
                      <span className="rounded-full border px-2.5 py-1 text-xs font-medium capitalize">owner</span>
                    ) : (
                      <select
                        value={member.role}
                        disabled={savingMember === member.id}
                        onChange={(e) => void updateMember(member.id, "role", e.target.value)}
                        className="rounded-lg border bg-background px-2 py-1 text-xs"
                      >
                        <option value="admin">admin</option><option value="member">member</option><option value="viewer">viewer</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={member.status}
                      disabled={savingMember === member.id || member.role === "owner"}
                      onChange={(e) => void updateMember(member.id, "status", e.target.value)}
                      className="rounded-lg border bg-background px-2 py-1 text-xs capitalize"
                    >
                      <option value="active">active</option><option value="suspended">suspended</option><option value="invited">invited</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 capitalize text-muted-foreground">{member.user?.status ?? "unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && members.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No members found for this organization.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border bg-muted/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Configuration</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <LinkCard href="/ai-voice" title="AI & Voice" text="Provider readiness and Clara voice configuration." />
          <LinkCard href="/agents" title="Agents" text="Manage agent configuration, versions and policies." />
          <LinkCard href="/mail/accounts" title="Email accounts" text="Manage provider connections and mailbox structure." />
        </div>
      </section>
    </main>
  );
}

function Value({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 truncate text-sm font-semibold ${mono ? "font-mono text-xs" : ""}`}>{value}</p></div>;
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}

function LinkCard({ href, title, text }: { href: string; title: string; text: string }) {
  return <a href={href} className="rounded-xl border bg-background p-4 transition hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></a>;
}
