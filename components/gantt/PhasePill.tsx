"use client";
/**
 * PhasePill — phase bar with absolute positioning.
 * Supports click (open panel) + ⌘+click (multi-select).
 */

interface PhasePillProps {
  left: number;
  width: number;
  top: number;
  height?: number;
  label?: string | null;
  progress?: number;
  bg: string;
  fg: string;
  hasNote?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: "solid" | "tint" | "outline";
}

export function PhasePill({
  left, width, top, height = 26,
  label, progress = 0, bg, fg,
  hasNote = false, selected = false, dimmed = false,
  onClick, style: pillStyle = "solid",
}: PhasePillProps) {
  if (width < 2) return null;

  const showLabel = width >= 50 && label;
  const showProgress = progress > 0 && progress < 100 && width >= 110;

  const pillStyles: React.CSSProperties = {
    position: "absolute",
    left, top, width, height,
    borderRadius: 999,
    cursor: "pointer",
    overflow: "hidden",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    fontSize: 10,
    fontWeight: 600,
    fontFamily: "var(--font-display, system-ui)",
    letterSpacing: "0.01em",
    userSelect: "none",
    transition: "filter 140ms, transform 140ms, opacity 120ms",
    zIndex: selected ? 3 : 2,
    opacity: dimmed ? 0.35 : 1,
    outline: selected ? "2px solid var(--klint-navy, #001036)" : undefined,
    outlineOffset: selected ? "1px" : undefined,
    ...(pillStyle === "solid"
      ? { background: bg, color: fg }
      : pillStyle === "tint"
      ? { background: bg + "33", color: bg, border: `1px solid ${bg}55` }
      : { background: "white", color: bg, border: `1.5px solid ${bg}` }),
  };

  return (
    <div
      style={pillStyles}
      onClick={onClick}
      title={label ?? undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(e as unknown as React.MouseEvent)}
      onMouseEnter={(e) => {
        if (!dimmed) {
          (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.filter = "";
        (e.currentTarget as HTMLElement).style.transform = "";
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
          paddingLeft: 10, paddingRight: hasNote ? 20 : 10,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          maxWidth: "100%",
        }}>
          {label}
          {showProgress && ` — ${progress}%`}
        </span>
      )}
      {hasNote && (
        <span style={{ position: "absolute", right: 6, fontSize: 9, opacity: 0.7 }} aria-label="Note">✎</span>
      )}
    </div>
  );
}

export default PhasePill;
