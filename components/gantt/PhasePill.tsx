/**
 * PhasePill — a phase bar rendered with absolute positioning in the timeline.
 * Position and size are computed by the parent (already in pixels).
 */

interface PhasePillProps {
  left: number;       // px from timeline left
  width: number;      // px
  top: number;        // px from lot row top
  height?: number;    // pill height (default 26)
  label?: string | null;
  progress?: number;  // 0–100
  bg: string;         // fill color
  fg: string;         // text color
  hasNote?: boolean;
  onClick?: () => void;
  style?: "solid" | "tint" | "outline";
}

export function PhasePill({
  left,
  width,
  top,
  height = 26,
  label,
  progress = 0,
  bg,
  fg,
  hasNote = false,
  onClick,
  style: pillStyle = "solid",
}: PhasePillProps) {
  // Don't render invisible pills
  if (width < 2) return null;

  const showLabel = width >= 50 && label;
  const showProgress = progress > 0 && progress < 100 && width >= 110;

  const pillStyles: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    borderRadius: 999,
    cursor: onClick ? "pointer" : "default",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    fontSize: 10,
    fontWeight: 600,
    fontFamily: "var(--font-display, system-ui)",
    letterSpacing: "0.01em",
    userSelect: "none",
    transition: "filter 140ms, transform 140ms",
    zIndex: 2,
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
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.filter = "";
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {/* Progress overlay */}
      {showProgress && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${progress}%`,
            height: "100%",
            background: "rgba(255,255,255,0.25)",
            borderRadius: "999px 0 0 999px",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Label */}
      {showLabel && (
        <span
          style={{
            position: "relative",
            paddingLeft: 10,
            paddingRight: hasNote ? 20 : 10,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {label}
          {showProgress && ` — ${progress}%`}
        </span>
      )}

      {/* Note indicator */}
      {hasNote && (
        <span
          style={{
            position: "absolute",
            right: 6,
            fontSize: 9,
            opacity: 0.7,
          }}
          aria-label="Note"
        >
          ✎
        </span>
      )}
    </div>
  );
}

export default PhasePill;
