"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserAllowInternational } from "@/lib/actions/members";
import { adminResetPassword } from "@/lib/actions/authActions";
import { adminCreateUser, adminUpdateUser, adminDisableUser, adminEnableUser, adminDeleteUser } from "@/lib/actions/adminUsers";
import { ApparenceSection } from "@/app/(app)/parametres/ApparenceSection";
import { GeoSecuriteSection } from "@/app/(app)/parametres/GeoSecuriteSection";
import { DroitsTab, LogsPanel, ParametresTabs } from "@/app/(app)/parametres/ParametresTabs";
import type { AppSettings, SecuritySettings } from "@/lib/actions/appSettings";
import type { PermissionMatrix } from "@/lib/permissions";
import type { ConnectionLogRow, GanttData, ExistingUserRow, ActivityEntry, DirectoryContact, PlanningGroupRow, PlatformEventRow } from "@/lib/db/queries";

type MainTab = "global" | "planning";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  disabledAt: Date | null;
  createdAt: Date;
  allowInternational: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  admin:   "Administrateur",
  user:    "Utilisateur",
  contact: "Contact",
};

const EVENT_LABELS: Record<string, string> = {
  password_reset: "Réinitialisation MDP",
  user_created:   "Création utilisateur",
  user_updated:   "Modification utilisateur",
  user_disabled:  "Désactivation",
  user_enabled:   "Réactivation",
  user_deleted:   "Suppression",
};

function fmtDatetime(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "";
  const cp1 = code.toUpperCase().charCodeAt(0) - 65 + 0x1F1E6;
  const cp2 = code.toUpperCase().charCodeAt(1) - 65 + 0x1F1E6;
  return String.fromCodePoint(cp1) + String.fromCodePoint(cp2);
}

// ── Shared styles ───────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
  border: "1px solid transparent", cursor: "pointer", whiteSpace: "nowrap",
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: "#2563EB", color: "#fff", borderColor: "#2563EB" };
const BTN_GHOST:   React.CSSProperties = { ...BTN, background: "transparent", color: "#374151", borderColor: "#D1D5DB" };
const BTN_DANGER:  React.CSSProperties = { ...BTN, background: "transparent", color: "#DC2626", borderColor: "#FCA5A5" };
const BTN_WARN:    React.CSSProperties = { ...BTN, background: "transparent", color: "#D97706", borderColor: "#FCD34D" };

// ── Card wrapper ────────────────────────────────────────────────────────────

function SectionCard({
  title, subtitle, action, children,
}: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--klint-line)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid var(--klint-line)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--klint-text)" }}>{title}</p>
          {subtitle && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── Modal overlay ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 12, width: 480, maxWidth: "calc(100vw - 32px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: "16px 20px 14px", borderBottom: "1px solid var(--klint-line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F2746" }}>{title}</span>
          <button type="button" onClick={onClose} style={{ ...BTN_GHOST, padding: "2px 8px", fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: "20px", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 6, border: "1px solid #D1D5DB",
  fontSize: 13, color: "#111827", outline: "none", width: "100%", boxSizing: "border-box",
};

// ── Create / Edit user modal ─────────────────────────────────────────────────

function UserFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: { id: string; name: string; email: string; role: string };
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
}) {
  const [name,  setName]  = useState(initial?.name  ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role,  setRole]  = useState<"admin" | "user" | "contact">(
    (initial?.role as "admin" | "user" | "contact") ?? "user"
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = mode === "create"
      ? await adminCreateUser({ name, email, role })
      : await adminUpdateUser({ userId: initial!.id, name, email, role });
    setPending(false);
    if (!res.success) { setError(res.error ?? "Erreur"); return; }
    onSaved({
      id:                 mode === "create" ? (res as { userId?: string }).userId ?? "" : initial!.id,
      name, email, role,
      disabledAt:         initial?.role ? (null as Date | null) : null,
      createdAt:          new Date(),
      allowInternational: false,
    });
    onClose();
  }

  return (
    <Modal title={mode === "create" ? "Nouvel utilisateur" : "Modifier l'utilisateur"} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Nom complet">
            <input required value={name} onChange={(e) => setName(e.target.value)} style={INPUT_STYLE} placeholder="Prénom Nom" />
          </Field>
        </div>
        <Field label="Adresse email">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={INPUT_STYLE} placeholder="prenom.nom@klint-consulting.com" />
        </Field>
        <Field label="Rôle">
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user" | "contact")} style={INPUT_STYLE}>
            <option value="user">Utilisateur</option>
            <option value="admin">Administrateur</option>
            <option value="contact">Contact</option>
          </select>
        </Field>
        {mode === "create" && (
          <div style={{ fontSize: 12, color: "#64748B", padding: "8px 12px", background: "#F0F7FF", borderRadius: 6, border: "1px solid #BFDBFE" }}>
            Le mot de passe initial sera <strong>Klint2026!</strong> — l&apos;utilisateur devra le modifier.
          </div>
        )}
        {error && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <button type="button" style={BTN_GHOST} onClick={onClose}>Annuler</button>
          <button type="submit" style={BTN_PRIMARY} disabled={pending}>
            {pending ? "Enregistrement…" : mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Confirm modal (reset / disable / delete) ─────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmStyle, onClose, onConfirm,
}: {
  title: string; message: string; confirmLabel: string;
  confirmStyle: React.CSSProperties; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState("");

  async function go() {
    setPending(true); setError("");
    try { await onConfirm(); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setPending(false); }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>{message}</p>
        {error && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" style={BTN_GHOST} onClick={onClose}>Annuler</button>
          <button type="button" style={confirmStyle} disabled={pending} onClick={go}>
            {pending ? "En cours…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Users section ────────────────────────────────────────────────────────────

type FilterStatus = "actifs" | "desactives" | "tous";

function UsersSection({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("actifs");

  const [createOpen,   setCreateOpen]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<AdminUser | null>(null);
  const [resetTarget,  setResetTarget]  = useState<AdminUser | null>(null);
  const [disableTarget,setDisableTarget]= useState<AdminUser | null>(null);
  const [enableTarget, setEnableTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const filtered = users.filter((u) => {
    if (filter === "actifs")    return !u.disabledAt;
    if (filter === "desactives") return !!u.disabledAt;
    return true;
  });

  function toggleInternational(userId: string, current: boolean) {
    setPendingId(userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, allowInternational: !current } : u));
    startTransition(async () => {
      await setUserAllowInternational(userId, !current);
      setPendingId(null);
    });
  }

  function handleSaved(updated: AdminUser) {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === updated.id);
      if (idx === -1) return [...prev, updated];
      return prev.map((u, i) => i === idx ? { ...u, ...updated } : u);
    });
  }

  const CHIPS: { id: FilterStatus; label: string }[] = [
    { id: "actifs",     label: "Actifs" },
    { id: "desactives", label: "Désactivés" },
    { id: "tous",       label: "Tous" },
  ];

  return (
    <>
      {/* Toolbar */}
      <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--klint-line)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {CHIPS.map((c) => (
            <button key={c.id} type="button" onClick={() => setFilter(c.id)} style={{
              ...BTN_GHOST,
              background: filter === c.id ? "#EFF6FF" : "transparent",
              borderColor: filter === c.id ? "#2563EB" : "#D1D5DB",
              color: filter === c.id ? "#2563EB" : "#374151",
              fontWeight: filter === c.id ? 600 : 400,
            }}>{c.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" style={BTN_PRIMARY} onClick={() => setCreateOpen(true)}>
          + Nouvel utilisateur
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid var(--klint-line)", background: "#F8FAFC" }}>
              {["Utilisateur", "Rôle", "Statut", "Étranger autorisé", "Créé le", "Actions"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 20px", fontWeight: 600, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--klint-line)", opacity: u.disabledAt ? 0.6 : 1 }}>
                <td style={{ padding: "10px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", background: u.disabledAt ? "#94A3B8" : "#0F2746",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                    }}>
                      {(u.name || u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.name || "—"}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "10px 20px" }}>
                  <span style={{
                    display: "inline-block", fontSize: 11, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 20,
                    background: u.role === "admin" ? "#FEF3C7" : u.role === "user" ? "#DBEAFE" : "#F1F5F9",
                    color:      u.role === "admin" ? "#B45309" : u.role === "user" ? "#1D4ED8" : "#475569",
                  }}>
                    {u.role === "admin" ? "👑 " : u.role === "user" ? "✏ " : "👁 "}
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td style={{ padding: "10px 20px" }}>
                  {u.disabledAt
                    ? <span style={{ color: "#DC2626", fontSize: 12 }}>Désactivé</span>
                    : <span style={{ color: "#16A34A", fontSize: 12 }}>Actif</span>}
                </td>
                <td style={{ padding: "10px 20px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={u.allowInternational}
                      disabled={pendingId === u.id}
                      onChange={() => toggleInternational(u.id, u.allowInternational)}
                      style={{ width: 14, height: 14, accentColor: "#2563EB", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 12, color: u.allowInternational ? "#2563EB" : "#9CA3AF" }}>
                      {u.allowInternational ? "Oui" : "Non"}
                    </span>
                  </label>
                </td>
                <td style={{ padding: "10px 20px", color: "#6B7280", whiteSpace: "nowrap" }}>{fmtDatetime(u.createdAt)}</td>
                <td style={{ padding: "10px 20px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                    <button type="button" style={BTN_GHOST} title="Modifier" onClick={() => setEditTarget(u)}>✎</button>
                    <button type="button" style={BTN_WARN}  title="Réinitialiser MDP" onClick={() => setResetTarget(u)}>🔑</button>
                    {u.disabledAt
                      ? <button type="button" style={{ ...BTN_GHOST, color: "#16A34A", borderColor: "#86EFAC" }} title="Réactiver" onClick={() => setEnableTarget(u)}>✓ Réactiver</button>
                      : <button type="button" style={BTN_WARN} title="Désactiver" onClick={() => setDisableTarget(u)}>⏸</button>
                    }
                    <button type="button" style={BTN_DANGER} title="Supprimer" onClick={() => setDeleteTarget(u)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "28px 20px", textAlign: "center", color: "#94A3B8" }}>
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {createOpen && (
        <UserFormModal mode="create" onClose={() => setCreateOpen(false)} onSaved={handleSaved} />
      )}
      {editTarget && (
        <UserFormModal
          mode="edit" initial={editTarget}
          onClose={() => setEditTarget(null)} onSaved={handleSaved}
        />
      )}
      {resetTarget && (
        <ConfirmModal
          title="Réinitialiser le mot de passe"
          message={`Le mot de passe de ${resetTarget.name || resetTarget.email} sera remplacé par Klint2026!`}
          confirmLabel="Réinitialiser"
          confirmStyle={BTN_WARN}
          onClose={() => setResetTarget(null)}
          onConfirm={async () => {
            const r = await adminResetPassword(resetTarget.id);
            if (!r.success) throw new Error(r.error);
          }}
        />
      )}
      {disableTarget && (
        <ConfirmModal
          title="Désactiver l'utilisateur"
          message={`${disableTarget.name || disableTarget.email} ne pourra plus se connecter. Réversible.`}
          confirmLabel="Désactiver"
          confirmStyle={BTN_WARN}
          onClose={() => setDisableTarget(null)}
          onConfirm={async () => {
            const r = await adminDisableUser(disableTarget.id);
            if (!r.success) throw new Error(r.error);
            setUsers((prev) => prev.map((u) => u.id === disableTarget.id ? { ...u, disabledAt: new Date() } : u));
          }}
        />
      )}
      {enableTarget && (
        <ConfirmModal
          title="Réactiver l'utilisateur"
          message={`${enableTarget.name || enableTarget.email} pourra de nouveau se connecter.`}
          confirmLabel="Réactiver"
          confirmStyle={{ ...BTN_PRIMARY }}
          onClose={() => setEnableTarget(null)}
          onConfirm={async () => {
            const r = await adminEnableUser(enableTarget.id);
            if (!r.success) throw new Error(r.error);
            setUsers((prev) => prev.map((u) => u.id === enableTarget.id ? { ...u, disabledAt: null } : u));
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Supprimer définitivement"
          message={`Cette action est irréversible. ${deleteTarget.name || deleteTarget.email} sera supprimé de la plateforme.`}
          confirmLabel="Supprimer définitivement"
          confirmStyle={BTN_DANGER}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const r = await adminDeleteUser(deleteTarget.id);
            if (!r.success) throw new Error(r.error);
            setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
          }}
        />
      )}
    </>
  );
}

// ── Connexions + platform events section ────────────────────────────────────

function ConnexionsSection({
  connLogs, platformEvents,
}: {
  connLogs: ConnectionLogRow[];
  platformEvents: PlatformEventRow[];
}) {
  const [view, setView] = useState<"connexions" | "admin">("connexions");

  return (
    <div>
      {/* Sub-switcher */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--klint-line)", display: "flex", gap: 4 }}>
        {([
          { id: "connexions" as const, label: "Connexions utilisateurs" },
          { id: "admin" as const,      label: "Événements admin" },
        ]).map((t) => (
          <button key={t.id} type="button" onClick={() => setView(t.id)} style={{
            ...BTN_GHOST,
            background: view === t.id ? "#EFF6FF" : "transparent",
            borderColor: view === t.id ? "#2563EB" : "#D1D5DB",
            color: view === t.id ? "#2563EB" : "#374151",
            fontWeight: view === t.id ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {view === "connexions" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid var(--klint-line)", background: "#F8FAFC" }}>
                {["Utilisateur", "Date", "Pays", "IP"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 20px", fontWeight: 600, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {connLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--klint-line)" }}>
                  <td style={{ padding: "9px 20px" }}>{log.email || "—"}</td>
                  <td style={{ padding: "9px 20px", color: "#6B7280" }}>{fmtDatetime(log.createdAt)}</td>
                  <td style={{ padding: "9px 20px" }}>
                    {log.countryCode ? `${countryFlag(log.countryCode)} ${log.country ?? log.countryCode}` : "—"}
                  </td>
                  <td style={{ padding: "9px 20px", fontFamily: "monospace", color: "#374151" }}>{log.ip ?? "—"}</td>
                </tr>
              ))}
              {connLogs.length === 0 && (
                <tr><td colSpan={4} style={{ padding: "24px 20px", color: "#94A3B8", textAlign: "center" }}>Aucune connexion enregistrée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === "admin" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid var(--klint-line)", background: "#F8FAFC" }}>
                {["Date", "Acteur", "Action", "Détail"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 20px", fontWeight: 600, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {platformEvents.map((ev) => (
                <tr key={ev.id} style={{ borderBottom: "1px solid var(--klint-line)" }}>
                  <td style={{ padding: "9px 20px", color: "#6B7280", whiteSpace: "nowrap" }}>{fmtDatetime(ev.createdAt)}</td>
                  <td style={{ padding: "9px 20px" }}>{ev.actorEmail ?? "—"}</td>
                  <td style={{ padding: "9px 20px" }}>
                    <span style={{
                      display: "inline-block", fontSize: 11, fontWeight: 600,
                      padding: "2px 8px", borderRadius: 20,
                      background: ev.eventType === "user_deleted" ? "#FEE2E2"
                        : ev.eventType === "user_disabled" ? "#FEF3C7"
                        : ev.eventType === "password_reset" ? "#FEF9C3"
                        : "#DBEAFE",
                      color: ev.eventType === "user_deleted" ? "#DC2626"
                        : ev.eventType === "user_disabled" ? "#D97706"
                        : ev.eventType === "password_reset" ? "#B45309"
                        : "#1D4ED8",
                    }}>
                      {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                    </span>
                  </td>
                  <td style={{ padding: "9px 20px", color: "#374151" }}>{ev.summary}</td>
                </tr>
              ))}
              {platformEvents.length === 0 && (
                <tr><td colSpan={4} style={{ padding: "24px 20px", color: "#94A3B8", textAlign: "center" }}>Aucun événement enregistré.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Global admin panel (avec sous-onglets) ─────────────────────────────────

type GlobalTab = "utilisateurs" | "apparence" | "securite" | "droits" | "logs" | "connexions";

const GLOBAL_TABS: { id: GlobalTab; label: string; desc: string }[] = [
  { id: "utilisateurs", label: "Utilisateurs & rôles", desc: "Accès à l'application" },
  { id: "apparence",    label: "Apparence",            desc: "Logo et favicon" },
  { id: "securite",     label: "Sécurité",             desc: "Restrictions géographiques" },
  { id: "droits",       label: "Droits & rôles",       desc: "Permissions par rôle" },
  { id: "logs",         label: "Logs erreurs",          desc: "Erreurs applicatives" },
  { id: "connexions",   label: "Connexions",            desc: "Historique des connexions et événements admin" },
];

function GlobalPanel({
  appCfg, permissions, securitySettings, connLogs, allUsers, platformEvts,
}: {
  appCfg: AppSettings; permissions: PermissionMatrix; securitySettings: SecuritySettings;
  connLogs: ConnectionLogRow[]; allUsers: AdminUser[]; platformEvts: PlatformEventRow[];
}) {
  const [activeGlobal, setActiveGlobal] = useState<GlobalTab>("utilisateurs");
  const current = GLOBAL_TABS.find((t) => t.id === activeGlobal)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Sub-tab bar */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: "1px solid var(--klint-line)",
        marginBottom: 20,
      }}>
        {GLOBAL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveGlobal(t.id)}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: activeGlobal === t.id ? 600 : 400,
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: activeGlobal === t.id ? "2px solid #2563EB" : "2px solid transparent",
              color: activeGlobal === t.id ? "#2563EB" : "#374151",
              marginBottom: -1,
              transition: "color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      {activeGlobal === "utilisateurs" && (
        <SectionCard
          title="Utilisateurs & rôles globaux"
          subtitle="Gestion des comptes et droits d'accès à l'application"
          action={
            <span style={{ fontSize: 11, color: "#64748B" }}>
              {allUsers.length} compte{allUsers.length !== 1 ? "s" : ""}
            </span>
          }
        >
          <UsersSection initialUsers={allUsers} />
        </SectionCard>
      )}

      {activeGlobal === "apparence" && (
        <SectionCard title="Apparence" subtitle={current.desc}>
          <div style={{ padding: "16px 20px" }}>
            <ApparenceSection appCfg={appCfg} />
          </div>
        </SectionCard>
      )}

      {activeGlobal === "securite" && (
        <SectionCard title="Sécurité" subtitle={current.desc}>
          <div style={{ padding: "16px 20px" }}>
            <GeoSecuriteSection securitySettings={securitySettings} />
          </div>
        </SectionCard>
      )}

      {activeGlobal === "droits" && (
        <SectionCard title="Droits & rôles" subtitle="Permissions par rôle sur toute la plateforme">
          <DroitsTab permissions={permissions} />
        </SectionCard>
      )}

      {activeGlobal === "logs" && (
        <SectionCard title="Logs erreurs" subtitle={current.desc}>
          <div style={{ padding: "16px 20px" }}>
            <LogsPanel />
          </div>
        </SectionCard>
      )}

      {activeGlobal === "connexions" && (
        <SectionCard
          title="Connexions & événements admin"
          subtitle={current.desc}
        >
          <ConnexionsSection connLogs={connLogs} platformEvents={platformEvts} />
        </SectionCard>
      )}

    </div>
  );
}

// ── Planning panel ──────────────────────────────────────────────────────────

function PlanningPanel({
  planningList, activePlanningId, planningData, appCfg, permissions,
  securitySettings, existingUsers, activityEntries, directoryContacts, syncGroups,
}: {
  planningList: Array<{id: string; name: string}>;
  activePlanningId: string | null;
  planningData: GanttData | null;
  appCfg: AppSettings;
  permissions: PermissionMatrix;
  securitySettings: SecuritySettings;
  existingUsers: ExistingUserRow[];
  activityEntries: ActivityEntry[];
  directoryContacts: DirectoryContact[];
  syncGroups: PlanningGroupRow[];
}) {
  const router = useRouter();
  const activeName = planningList.find((p) => p.id === activePlanningId)?.name ?? "—";

  function handlePlanningChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/administration?planningId=${e.target.value}&tab=planning`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Context banner with planning selector */}
      <div style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)",
        border: "1px solid #BFDBFE", borderRadius: 10,
        padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Paramètres du planning
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: "#0F2746" }}>
            {activeName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B", fontStyle: "italic" }}>
            Contexte défini par le sélecteur — pas de doublon dans les paramètres
          </p>
        </div>
        <select
          value={activePlanningId ?? ""}
          onChange={handlePlanningChange}
          style={{
            fontSize: 12, padding: "6px 12px", borderRadius: 6,
            border: "1px solid #BFDBFE", background: "#fff", color: "#374151",
            cursor: "pointer", maxWidth: 220,
          }}
        >
          {planningList.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* ParametresTabs — masque les onglets globaux déjà dans l'onglet Administration */}
      {planningData ? (
        <ParametresTabs
          data={planningData}
          appCfg={appCfg}
          userRole="admin"
          permissions={permissions}
          securitySettings={securitySettings}
          existingUsers={existingUsers}
          activityEntries={activityEntries}
          connLogs={[]}
          directoryContacts={directoryContacts}
          planningGroups={syncGroups}
          allPlannings={planningList}
          hideTabs={["apparence", "securite", "droits", "logs"]}
        />
      ) : (
        <p style={{ fontSize: 13, color: "#94A3B8", padding: "32px 0", textAlign: "center" }}>
          Aucun planning disponible.
        </p>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  appCfg: AppSettings;
  permissions: PermissionMatrix;
  securitySettings: SecuritySettings;
  connLogs: ConnectionLogRow[];
  platformEvents: PlatformEventRow[];
  allUsers: AdminUser[];
  planningList: Array<{id: string; name: string}>;
  activePlanningId: string | null;
  planningData: GanttData | null;
  existingUsers: ExistingUserRow[];
  activityEntries: ActivityEntry[];
  directoryContacts: DirectoryContact[];
  syncGroups: PlanningGroupRow[];
  defaultTab: MainTab;
}

export function AdministrationClient({
  appCfg, permissions, securitySettings, connLogs, platformEvents,
  allUsers, planningList, activePlanningId, planningData,
  existingUsers, activityEntries, directoryContacts, syncGroups,
  defaultTab,
}: Props) {
  const router = useRouter();
  const [active, setActive] = useState<MainTab>(defaultTab);

  const activePlanningName = planningList.find((p) => p.id === activePlanningId)?.name ?? "Planning";

  function switchTab(tab: MainTab) {
    setActive(tab);
    router.push(
      `/administration?planningId=${activePlanningId ?? ""}&tab=${tab}`,
      { scroll: false },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Main tab switcher ─────────────────────────────────────────── */}
      <div style={{
        padding: "0 32px",
        background: "#fff",
        borderBottom: "1.5px solid var(--klint-line)",
        flexShrink: 0,
        display: "flex",
        gap: 4,
      }}>
        {([
          { id: "global" as const,   label: "⚙ Administration (global)" },
          { id: "planning" as const, label: `📋 Paramètres — ${activePlanningName}` },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: active === t.id ? 600 : 400,
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: active === t.id ? "2.5px solid #2563EB" : "2.5px solid transparent",
              color: active === t.id ? "#2563EB" : "#374151",
              marginBottom: -1.5,
              transition: "color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {active === "global" && (
          <GlobalPanel
            appCfg={appCfg}
            permissions={permissions}
            securitySettings={securitySettings}
            connLogs={connLogs}
            platformEvts={platformEvents}
            allUsers={allUsers}
          />
        )}
        {active === "planning" && (
          <PlanningPanel
            planningList={planningList}
            activePlanningId={activePlanningId}
            planningData={planningData}
            appCfg={appCfg}
            permissions={permissions}
            securitySettings={securitySettings}
            existingUsers={existingUsers}
            activityEntries={activityEntries}
            directoryContacts={directoryContacts}
            syncGroups={syncGroups}
          />
        )}
      </div>
    </div>
  );
}
