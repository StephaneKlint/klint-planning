"use client";

import { useState, useTransition } from "react";
import { setUserAllowInternational } from "@/lib/actions/members";
import { ApparenceSection } from "@/app/(app)/parametres/ApparenceSection";
import { GeoSecuriteSection } from "@/app/(app)/parametres/GeoSecuriteSection";
import { DroitsTab } from "@/app/(app)/parametres/ParametresTabs";
import { LogsPanel } from "@/app/(app)/parametres/ParametresTabs";
import type { AppSettings, SecuritySettings } from "@/lib/actions/appSettings";
import type { PermissionMatrix } from "@/lib/permissions";
import type { ConnectionLogRow } from "@/lib/db/queries";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  disabledAt: Date | null;
  createdAt: Date;
  allowInternational: boolean;
};

type Tab = "utilisateurs" | "apparence" | "securite" | "droits" | "logs" | "connexions";

const TABS: { id: Tab; label: string }[] = [
  { id: "utilisateurs", label: "Utilisateurs & rôles" },
  { id: "apparence",    label: "Apparence" },
  { id: "securite",     label: "Sécurité" },
  { id: "droits",       label: "Droits & rôles" },
  { id: "logs",         label: "Logs erreurs" },
  { id: "connexions",   label: "Connexions" },
];

const ROLE_LABELS: Record<string, string> = {
  admin:   "Administrateur",
  user:    "Utilisateur",
  contact: "Contact",
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

interface Props {
  appCfg:           AppSettings;
  permissions:      PermissionMatrix;
  securitySettings: SecuritySettings;
  connLogs:         ConnectionLogRow[];
  allUsers:         AdminUser[];
}

function UsersTab({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function toggleInternational(userId: string, current: boolean) {
    setPendingId(userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, allowInternational: !current } : u));
    startTransition(async () => {
      await setUserAllowInternational(userId, !current);
      setPendingId(null);
    });
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        {users.length} compte(s) enregistré(s).
        La colonne <strong>Étranger autorisé</strong> permet d&apos;exempter un compte du blocage géographique.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid var(--klint-line)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Nom</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Email</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Rôle</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Statut</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Étranger autorisé</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Créé le</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--klint-line)" }}>
                <td style={{ padding: "9px 12px" }}>{u.name || "—"}</td>
                <td style={{ padding: "9px 12px", color: "#374151" }}>{u.email}</td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{
                    display: "inline-block", fontSize: 11, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 20,
                    background: u.role === "admin" ? "#EDE9FE" : u.role === "user" ? "#DBEAFE" : "#F3F4F6",
                    color:      u.role === "admin" ? "#6D28D9" : u.role === "user" ? "#1D4ED8" : "#6B7280",
                  }}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td style={{ padding: "9px 12px" }}>
                  {u.disabledAt
                    ? <span style={{ color: "#DC2626", fontSize: 12 }}>Désactivé</span>
                    : <span style={{ color: "#16A34A", fontSize: 12 }}>Actif</span>}
                </td>
                <td style={{ padding: "9px 12px" }}>
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
                <td style={{ padding: "9px 12px", color: "#6B7280" }}>{fmtDatetime(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdministrationClient({ appCfg, permissions, securitySettings, connLogs, allUsers }: Props) {
  const [active, setActive] = useState<Tab>("utilisateurs");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px 32px", gap: 0 }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--klint-text)" }}>Administration</h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>
          Paramètres globaux de la plateforme — accessibles aux administrateurs uniquement.
        </p>
      </div>

      {/* Onglets */}
      <div style={{
        display: "flex", gap: 2, borderBottom: "1.5px solid var(--klint-line)",
        marginBottom: 24, flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: active === tab.id ? 600 : 400,
              border: "none", background: "none", cursor: "pointer",
              borderBottom: active === tab.id ? "2px solid var(--klint-accent)" : "2px solid transparent",
              color: active === tab.id ? "var(--klint-accent)" : "#374151",
              marginBottom: -1.5,
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* ─── Utilisateurs & rôles ───────────────────────────────── */}
        {active === "utilisateurs" && (
          <UsersTab initialUsers={allUsers} />
        )}

        {/* ─── Apparence ──────────────────────────────────────────── */}
        {active === "apparence" && (
          <ApparenceSection appCfg={appCfg} />
        )}

        {/* ─── Sécurité ───────────────────────────────────────────── */}
        {active === "securite" && (
          <div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              Paramètres de sécurité globaux de la plateforme.
            </p>
            <GeoSecuriteSection securitySettings={securitySettings} />
          </div>
        )}

        {/* ─── Droits & rôles ─────────────────────────────────────── */}
        {active === "droits" && (
          <DroitsTab permissions={permissions} />
        )}

        {/* ─── Logs erreurs ───────────────────────────────────────── */}
        {active === "logs" && (
          <LogsPanel />
        )}

        {/* ─── Connexions ─────────────────────────────────────────── */}
        {active === "connexions" && (
          <div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
              Dernières {connLogs.length} connexions à la plateforme.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--klint-line)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Utilisateur</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Date</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>Pays</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {connLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--klint-line)" }}>
                      <td style={{ padding: "9px 12px" }}>{log.email || "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#6B7280" }}>{fmtDatetime(log.createdAt)}</td>
                      <td style={{ padding: "9px 12px" }}>
                        {log.countryCode ? `${countryFlag(log.countryCode)} ${log.country ?? log.countryCode}` : "—"}
                      </td>
                      <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#374151" }}>
                        {log.ip ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {connLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "24px 12px", color: "#6B7280", textAlign: "center" }}>
                        Aucune connexion enregistrée.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
