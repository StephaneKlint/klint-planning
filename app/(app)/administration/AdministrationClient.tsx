"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserAllowInternational } from "@/lib/actions/members";
import { ApparenceSection } from "@/app/(app)/parametres/ApparenceSection";
import { GeoSecuriteSection } from "@/app/(app)/parametres/GeoSecuriteSection";
import { DroitsTab, LogsPanel, ParametresTabs } from "@/app/(app)/parametres/ParametresTabs";
import type { AppSettings, SecuritySettings } from "@/lib/actions/appSettings";
import type { PermissionMatrix } from "@/lib/permissions";
import type { ConnectionLogRow, GanttData, ExistingUserRow, ActivityEntry, DirectoryContact, PlanningGroupRow } from "@/lib/db/queries";

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

// ── Users section (with optimistic allowInternational toggle) ───────────────

function UsersSection({ initialUsers }: { initialUsers: AdminUser[] }) {
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
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid var(--klint-line)", background: "#F8FAFC" }}>
            {["Utilisateur", "Rôle", "Statut", "Étranger autorisé", "Créé le"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 20px", fontWeight: 600, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--klint-line)" }}>
              <td style={{ padding: "10px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: "#0F2746",
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
              <td style={{ padding: "10px 20px", color: "#6B7280" }}>{fmtDatetime(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Connexions table ────────────────────────────────────────────────────────

function ConnexionsSection({ connLogs }: { connLogs: ConnectionLogRow[] }) {
  return (
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
            <tr>
              <td colSpan={4} style={{ padding: "24px 20px", color: "#94A3B8", textAlign: "center" }}>
                Aucune connexion enregistrée.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Global admin panel ──────────────────────────────────────────────────────

function GlobalPanel({
  appCfg, permissions, securitySettings, connLogs, allUsers,
}: {
  appCfg: AppSettings; permissions: PermissionMatrix; securitySettings: SecuritySettings;
  connLogs: ConnectionLogRow[]; allUsers: AdminUser[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Callout */}
      <div style={{
        background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10,
        padding: "12px 18px", display: "flex", gap: 10, alignItems: "flex-start",
        fontSize: 12, color: "#1E40AF",
      }}>
        <span>ℹ</span>
        <span>
          Ces paramètres s'appliquent à <strong>tous les plannings</strong>.
          Les types définis ici sont proposés par défaut lors de la création d'un nouveau planning — chaque planning peut ensuite les personnaliser.
        </span>
      </div>

      {/* Users */}
      <SectionCard
        title="Utilisateurs & rôles globaux"
        subtitle="Accès à l'application"
        action={
          <span style={{ fontSize: 11, color: "#64748B" }}>
            {allUsers.length} compte{allUsers.length !== 1 ? "s" : ""}
          </span>
        }
      >
        <UsersSection initialUsers={allUsers} />
      </SectionCard>

      {/* Grid 2: Apparence + Sécurité */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <SectionCard title="Apparence" subtitle="Logo et favicon de l'application">
          <div style={{ padding: "16px 20px" }}>
            <ApparenceSection appCfg={appCfg} />
          </div>
        </SectionCard>
        <SectionCard title="Sécurité" subtitle="Restrictions géographiques">
          <div style={{ padding: "16px 20px" }}>
            <GeoSecuriteSection securitySettings={securitySettings} />
          </div>
        </SectionCard>
      </div>

      {/* Droits */}
      <SectionCard title="Droits & rôles" subtitle="Permissions par rôle sur toute la plateforme">
        <DroitsTab permissions={permissions} />
      </SectionCard>

      {/* Logs erreurs */}
      <SectionCard title="Logs erreurs" subtitle="Erreurs applicatives récentes">
        <div style={{ padding: "16px 20px" }}>
          <LogsPanel />
        </div>
      </SectionCard>

      {/* Connexions */}
      <SectionCard
        title="Connexions"
        subtitle={`Dernières ${connLogs.length} connexions à la plateforme`}
      >
        <ConnexionsSection connLogs={connLogs} />
      </SectionCard>
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
  appCfg, permissions, securitySettings, connLogs, allUsers,
  planningList, activePlanningId, planningData,
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
