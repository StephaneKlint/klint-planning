"use client";
/**
 * CommandPalette — ⌘K search. Navigate lots/phases/jalons by keyboard.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useGanttStore } from "@/store/ganttStore";
import { Icon } from "@/components/ui/Icon";
import type { GanttData } from "@/lib/db/queries";
import styles from "./CommandPalette.module.css";

interface Result {
  id: string;
  kind: "lot" | "phase" | "milestone";
  label: string;
  sub: string;
  domainColor?: string;
}

interface CommandPaletteProps {
  data: GanttData;
  planningId?: string;
}

export function CommandPalette({ data }: CommandPaletteProps) {
  const { commandPaletteOpen, setCommandPaletteOpen, openEdit } = useGanttStore();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K global shortcut — capture phase so it fires before Vercel toolbar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setCommandPaletteOpen(!commandPaletteOpen);
        setQuery("");
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setCursor(0);
    }
  }, [commandPaletteOpen]);

  // Build search results
  const domainByLotId = Object.fromEntries(
    data.lots.map((l) => [l.id, data.domains.find((d) => d.id === l.domainId)])
  );

  const results: Result[] = [];

  if (query.length >= 1) {
    const q = query.toLowerCase();

    // Lots
    data.lots
      .filter((l) => l.name.toLowerCase().includes(q) || (l.subtitle ?? "").toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((l) => {
        const dom = domainByLotId[l.id];
        results.push({ id: l.id, kind: "lot", label: l.name, sub: dom?.name ?? "", domainColor: dom?.phaseColor });
      });

    // Phases
    data.phases
      .filter((p) => (p.label ?? p.type).toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((p) => {
        const lot = data.lots.find((l) => l.id === p.lotId);
        const dom = lot ? domainByLotId[lot.id] : undefined;
        results.push({ id: p.id, kind: "phase", label: p.label ?? p.type, sub: lot?.name ?? "", domainColor: dom?.phaseColor });
      });

    // Milestones
    data.milestones
      .filter((m) => m.label.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((m) => {
        const lot = data.lots.find((l) => l.id === m.lotId);
        const dom = lot ? domainByLotId[lot.id] : undefined;
        results.push({ id: m.id, kind: "milestone", label: m.label, sub: m.date, domainColor: dom?.phaseColor });
      });
  }

  const handleSelect = useCallback((r: Result) => {
    setCommandPaletteOpen(false);
    setQuery("");
    openEdit({ kind: r.kind as "phase" | "lot" | "milestone", id: r.id });
  }, [setCommandPaletteOpen, openEdit]);

  if (!commandPaletteOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={() => setCommandPaletteOpen(false)} />

      <div className={styles.palette} role="dialog" aria-label="Recherche rapide">
        <div className={styles.inputRow}>
          <Icon name="search" size={14} style={{ color: "#9CA3AF", flexShrink: 0 }} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Rechercher un lot, une phase, un jalon…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter" && results[cursor]) handleSelect(results[cursor]);
              if (e.key === "Escape") setCommandPaletteOpen(false);
            }}
          />
          <kbd className={styles.esc}>Esc</kbd>
        </div>

        {query.length >= 1 && (
          <div className={styles.results}>
            {results.length === 0 ? (
              <div className={styles.empty}>Aucun résultat pour « {query} »</div>
            ) : (
              results.map((r, i) => (
                <button
                  key={r.id}
                  className={`${styles.result} ${i === cursor ? styles.resultActive : ""}`}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setCursor(i)}
                >
                  <span
                    className={styles.kindDot}
                    style={{ background: r.domainColor ?? "#94A3B8" }}
                  />
                  <span className={styles.resultLabel}>{r.label}</span>
                  <span className={styles.resultSub}>{r.sub}</span>
                  <span className={styles.kindTag}>
                    {r.kind === "lot" ? "Projet" : r.kind === "phase" ? "Phase" : "Jalon"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {query.length === 0 && (
          <div className={styles.hints}>
            <span>↑↓ naviguer</span>
            <span>↵ sélectionner</span>
            <span>Esc fermer</span>
          </div>
        )}
      </div>
    </>
  );
}

export default CommandPalette;
