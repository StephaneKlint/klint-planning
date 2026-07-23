"use client";
/**
 * PhasePill — phase bar with absolute positioning.
 * Supports click (open panel) + ⌘+click (multi-select).
 */

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface PhasePillProps {
  left: number;
  width: number;
  top: number;
  height?: number;
  label?: string | null;
  startDate?: string;
  endDate?: string;
  progress?: number;
  bg: string;
  fg: string;
  hasNote?: boolean;
  selected?: boolean;
  /** true quand cette phase est ouverte dans l'EditPanel */
  editing?: boolean;
  dimmed?: boolean;
  /** statut métier de la phase — utilisé pour la distinction visuelle terminée/non-commencée */
  status?: string | null;
  onClick?: (e: React.MouseEvent) => void;
  style?: "solid" | "tint" | "outline";
  /** true while being dragged — disables hover transitions */
  dragging?: boolean;
  /** overrides the default pointer cursor */
  cursor?: React.CSSProperties["cursor"];
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave_?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** true when this phase is part of a sync group (shows a link icon) */
  isSynced?: boolean;
}

export function PhasePill({
  left, width, top, height = 26,
  label, startDate, endDate, progress = 0, bg, fg,
  hasNote = false, selected = false, editing = false, dimmed = false,
  status, onClick, style: pillStyle = "solid",
  dragging = false, cursor, onMouseDown, onMouseMove, onMouseLeave_,
  isSynced = false,
}: PhasePillProps) {
  if (width < 2) return null;

  // ── Distinction visuelle terminée / non-commencée ───────────────────────────
  // Option B : dashed pour "planned à 0%", stries pour "done / 100%"
  const isDone    = pillStyle === "solid" && (status === "done" || progress >= 100);
  const isPlanned = pillStyle === "solid" && status === "planned" && progress === 0 && !isDone;

  const showLabel = width >= 18 && label;
  const showProgress = !isDone && !isPlanned && progress > 0 && progress < 100 && width >= 110;

  // Shorten label for narrow pills
  const ABBREVS: Record<string, string> = {
    "Cadrage": "Cad.", "Développement": "Dév.", "Recette": "Rec.",
    "Formation": "For.", "Personnalisé": "Per.", "dev": "Dév.",
    "cadrage": "Cad.", "recette": "Rec.",
  };
  const displayLabel = (l: string | null | undefined) => {
    if (!l) return l;
    if (width >= 50) return l;
    if (width >= 36) return ABBREVS[l] ?? (l.length > 4 ? l.slice(0, 3) + "." : l);
    return ABBREVS[l] ?? l.slice(0, 1) + ".";
  };

  const pillStyles: React.CSSProperties = {
    position: "absolute",
    left, top, width, height,
    borderRadius: 999,
    overflow: isPlanned ? "visible" : "hidden",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    fontSize: 10,
    fontWeight: 600,
    fontFamily: "var(--font-display, system-ui)",
    letterSpacing: "0.01em",
    userSelect: "none",
    transition: dragging ? "none" : "filter 140ms, transform 140ms, opacity 120ms",
    cursor: cursor ?? "pointer",
    zIndex: editing ? 4 : selected ? 3 : 2,
    opacity: dimmed ? 0.35 : 1,
    outline: editing
      ? "2px solid #F59E0B"
      : selected ? "2px solid var(--klint-navy, #001036)" : undefined,
    outlineOffset: (editing || selected) ? "1px" : undefined,
    ...(pillStyle === "solid"
      ? isDone
        ? {
            background: bg,
            backgroundImage: `repeating-linear-gradient(-55deg, transparent 0px, transparent 6px, rgba(255,255,255,0.22) 6px, rgba(255,255,255,0.22) 8px)`,
            color: fg,
          }
        : isPlanned
        ? {
            background: "transparent",
            border: `1.5px dashed ${bg}`,
            color: bg,
          }
        : { background: bg, color: fg }
      : pillStyle === "tint"
      ? { background: bg + "33", color: bg, border: `1px solid ${bg}55` }
      : { background: "white", color: bg, border: `1.5px solid ${bg}` }),
  };

  return (
    <div
      style={pillStyles}
      onClick={onClick}
      title={[label, startDate && endDate ? `${fmtDate(startDate)} → ${fmtDate(endDate)}` : undefined].filter(Boolean).join(" · ")}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(e as unknown as React.MouseEvent)}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseEnter={(e) => {
        if (!dimmed && !dragging) {
          (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.filter = "";
        (e.currentTarget as HTMLElement).style.transform = "";
        onMouseLeave_?.(e);
      }}
    >
      {showProgress && (
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: `${progress}%`, height: "100%",
          background: "rgba(255,255,255,0.25)",
          borderRadius: "999px 0 0 999px",
          pointerEvents: "none",
        }} />
      )}
      {showLabel && (
        <span style={{
          position: "relative",
          paddingLeft: width >= 50 ? 10 : 4,
          paddingRight: (hasNote && isSynced) ? 30 : hasNote ? 20 : isSynced ? 18 : (width >= 50 ? 10 : 4),
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          maxWidth: "100%",
        }}>
          {isDone ? `✓ ${displayLabel(label)}` : displayLabel(label)}
          {showProgress && width >= 110 && ` — ${progress}%`}
        </span>
      )}
      {isSynced && (
        <span style={{ position: "absolute", right: hasNote ? 18 : 5, fontSize: 8, opacity: 0.75, letterSpacing: 0 }} aria-label="Synchronisé">⇄</span>
      )}
      {hasNote && (
        <span style={{ position: "absolute", right: 6, fontSize: 9, opacity: 0.7 }} aria-label="Note">✎</span>
      )}
    </div>
  );
}

export default PhasePill;
