"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./Parametres.module.css";
import type { GanttData } from "@/lib/db/queries";
import {
  addPhaseType, deletePhaseType,
  addMilestoneType, deleteMilestoneType,
  updateDomainCadence, updatePlanningSettings,
} from "@/lib/actions/settings";

type Tab = "general" | "cadence" | "phases" | "jalons" | "statuts";

const TABS: { id: Tab; label: string }[] = [
  { id: "general",  label: "Général" },
  { id: "cadence",  label: "Cadence" },
  { id: "phases",   label: "Types de phases" },
  { id: "jalons",   label: "Types de jalons" },
  { id: "statuts",  label: "Statuts" },
];

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const PRESET_COLORS = [
  "#1E3A8A","#312E81","#65A30D","#0D9488","#7C3AED",
  "#DC2626","#EA580C","#0369A1","#374151","#BE185D",
];

export function ParametresTabs({ data }: { data: GanttData }) {
  const router = useRouter();
  const [active, setActive] = useState<Tab>("general");
  const [isPending, startTransition] = useTransition();
  const { planning, settings, domains, phaseTypes, milestoneTypes, statuses } = data;

  // Phase type form state
  const [newPTCode, setNewPTCode] = useState("");
  const [newPTLabel, setNewPTLabel] = useState("");

  // Milestone type form state
  const [newMTCode, setNewMTCode] = useState("");
  const [newMTLabel, setNewMTLabel] = useState("");
  const [newMTColor, setNewMTColor] = useState(PRESET_COLORS[4]);

  return (
    <div className={styles.tabs}>
      <div className={styles.tabBar} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            className={`${styles.tabBtn} ${active === t.id ? styles.tabBtnActive : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Général ─────────────────────────────────────────────────── */}
      {active === "general" && (
        <div className={styles.tabPanel}>
          <form
            className={styles.settingsForm}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                await updatePlanningSettings({
                  planningId: planning.id,
                  autoLate: fd.get("autoLate") === "on",
                  autoCloseAfterMepDays: Number(fd.get("autoCloseAfterMepDays")),
                  notifyOnLate: fd.get("notifyOnLate") === "on",
                });
                router.refresh();
              });
            }}
          >
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Nom du planning</span>
                <span className={styles.fieldValue}>{planning.name}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Année</span>
                <span className={styles.fieldValue}>{planning.year}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Période</span>
                <span className={styles.fieldValue}>
                  {fmtDate(planning.viewStart)} → {fmtDate(planning.viewEnd)}
                </span>
              </div>
            </div>

            {settings && (
              <div className={styles.settingsBlock}>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input type="checkbox" name="autoLate" defaultChecked={settings.autoLate} />
                    Passer en retard automatiquement
                  </label>
                </div>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input type="checkbox" name="notifyOnLate" defaultChecked={settings.notifyOnLate} />
                    Notifier en cas de retard
                  </label>
                </div>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    Clôture auto après MEP (jours)
                  </label>
                  <input
                    type="number"
                    name="autoCloseAfterMepDays"
                    defaultValue={settings.autoCloseAfterMepDays}
                    min={0}
                    max={365}
                    className={styles.numInput}
                  />
                </div>
                <button type="submit" className={styles.saveBtn} disabled={isPending}>
                  {isPending ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── Cadence ─────────────────────────────────────────────────── */}
      {active === "cadence" && (
        <div className={styles.tabPanel}>
          <p className={styles.tabDesc}>
            Jours ouvrés entre la livraison et chaque jalon automatique, par domaine.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Domaine</th>
                <th>Livraison</th>
                <th>Pré-MEP</th>
                <th>CAB</th>
                <th>MEP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <CadenceRow
                  key={d.id}
                  domain={d}
                  planningId={planning.id}
                  isPending={isPending}
                  startTransition={startTransition}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Types de phases ─────────────────────────────────────────── */}
      {active === "phases" && (
        <div className={styles.tabPanel}>
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Code</th><th>Libellé</th><th></th></tr>
            </thead>
            <tbody>
              {phaseTypes.map((pt, i) => (
                <tr key={pt.id}>
                  <td className={styles.tdMuted}>{i + 1}</td>
                  <td><code className={styles.codeChip}>{pt.code}</code></td>
                  <td>{pt.label}</td>
                  <td>
                    <button
                      className={styles.deleteRowBtn}
                      title="Supprimer"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`Supprimer le type "${pt.label}" ?`)) {
                          startTransition(async () => {
                            await deletePhaseType(pt.id, planning.id);
                            router.refresh();
                          });
                        }
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPTCode.trim() || !newPTLabel.trim()) return;
              startTransition(async () => {
                await addPhaseType({ planningId: planning.id, code: newPTCode.trim(), label: newPTLabel.trim() });
                setNewPTCode("");
                setNewPTLabel("");
                router.refresh();
              });
            }}
          >
            <input
              className={styles.addInput}
              placeholder="code (ex. formation)"
              value={newPTCode}
              onChange={(e) => setNewPTCode(e.target.value)}
              maxLength={40}
            />
            <input
              className={styles.addInput}
              placeholder="Libellé"
              value={newPTLabel}
              onChange={(e) => setNewPTLabel(e.target.value)}
              maxLength={80}
            />
            <button type="submit" className={styles.addBtn} disabled={isPending || !newPTCode || !newPTLabel}>
              + Ajouter
            </button>
          </form>
        </div>
      )}

      {/* ── Types de jalons ─────────────────────────────────────────── */}
      {active === "jalons" && (
        <div className={styles.tabPanel}>
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Code</th><th>Libellé</th><th>Couleur</th><th></th></tr>
            </thead>
            <tbody>
              {milestoneTypes.map((mt, i) => (
                <tr key={mt.id}>
                  <td className={styles.tdMuted}>{i + 1}</td>
                  <td><code className={styles.codeChip}>{mt.code}</code></td>
                  <td>{mt.label}</td>
                  <td>
                    <span className={styles.colorSwatch} style={{ background: mt.color }} />
                    <span className={styles.tdMuted}>{mt.color}</span>
                  </td>
                  <td>
                    <button
                      className={styles.deleteRowBtn}
                      title="Supprimer"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`Supprimer le type jalon "${mt.label}" ?`)) {
                          startTransition(async () => {
                            await deleteMilestoneType(mt.id, planning.id);
                            router.refresh();
                          });
                        }
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newMTCode.trim() || !newMTLabel.trim()) return;
              startTransition(async () => {
                await addMilestoneType({ planningId: planning.id, code: newMTCode.trim(), label: newMTLabel.trim(), color: newMTColor });
                setNewMTCode("");
                setNewMTLabel("");
                router.refresh();
              });
            }}
          >
            <input
              className={styles.addInput}
              placeholder="code"
              value={newMTCode}
              onChange={(e) => setNewMTCode(e.target.value)}
              maxLength={40}
            />
            <input
              className={styles.addInput}
              placeholder="Libellé"
              value={newMTLabel}
              onChange={(e) => setNewMTLabel(e.target.value)}
              maxLength={80}
            />
            <div className={styles.colorPresets}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.presetDot} ${newMTColor === c ? styles.presetDotActive : ""}`}
                  style={{ background: c }}
                  onClick={() => setNewMTColor(c)}
                />
              ))}
            </div>
            <button type="submit" className={styles.addBtn} disabled={isPending || !newMTCode || !newMTLabel}>
              + Ajouter
            </button>
          </form>
        </div>
      )}

      {/* ── Statuts ─────────────────────────────────────────────────── */}
      {active === "statuts" && (
        <div className={styles.tabPanel}>
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Code</th><th>Libellé</th><th>Aperçu</th></tr>
            </thead>
            <tbody>
              {statuses.map((s, i) => (
                <tr key={s.id}>
                  <td className={styles.tdMuted}>{i + 1}</td>
                  <td><code className={styles.codeChip}>{s.code}</code></td>
                  <td>{s.label}</td>
                  <td>
                    <span className={styles.statusPreview} style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.tabDesc} style={{ marginTop: 12 }}>
            Les statuts sont synchronisés avec le système. L'édition libre arrive dans une prochaine version.
          </p>
        </div>
      )}
    </div>
  );
}

// ── CadenceRow — édition inline ────────────────────────────────────────────

type AnyDomain = GanttData["domains"][number];

function CadenceRow({
  domain,
  planningId,
  isPending,
  startTransition,
}: {
  domain: AnyDomain;
  planningId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [cad, setCad] = useState(domain.cadence);
  const styles_table = ""; // unused, handled at table level

  const save = (next: typeof cad) => {
    setCad(next);
    startTransition(async () => {
      await updateDomainCadence({
        domainId: domain.id,
        planningId,
        livraison: next.livraison,
        pmep: next.pmep,
        cab: next.cab,
        mep: next.mep,
      });
    });
  };

  return (
    <tr>
      <td>
        <span
          style={{
            display: "inline-block",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            background: `var(--d-${domain.code}-bg)`,
            color: `var(--d-${domain.code}-strong)`,
            marginRight: 6,
          }}
        >
          {domain.code.toUpperCase()}
        </span>
        {domain.name}
      </td>
      {(["livraison", "pmep", "cab", "mep"] as const).map((field) => (
        <td key={field}>
          <input
            type="number"
            min={0}
            max={60}
            value={cad[field]}
            disabled={isPending}
            onChange={(e) => save({ ...cad, [field]: Number(e.target.value) })}
            style={{
              width: 52,
              padding: "3px 6px",
              fontSize: 13,
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              textAlign: "center",
              fontFamily: "inherit",
            }}
          />
        </td>
      ))}
      <td></td>
    </tr>
  );
}
