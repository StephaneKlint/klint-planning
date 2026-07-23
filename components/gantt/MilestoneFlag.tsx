/**
 * MilestoneFlag — drapeau + leader + losange for a milestone.
 *
 * Anatomy (side="above"):
 *   [Flag chip]   ← colored label, positioned above the lot row
 *       │         ← thin vertical leader line
 *   [◇ diamond]  ← 10px rotated square, at row center Y
 *
 * side="below" is mirrored.
 *
 * All positions are absolute within the timeline body.
 */

export interface MilestoneFlagProps {
  centerX: number;       // horizontal center (px from timeline left)
  rowY: number;          // top of the lot row (px)
  rowH: number;          // lot row height (px)
  side: "above" | "below";
  level: number;         // 0-based lane (0 = closest to row)
  label: string;
  color: string;         // milestone type color (hex)
  laneH?: number;        // vertical step between lanes (default 18)
  diamondSize?: number;  // (default 10)
  labelH?: number;       // flag chip height (default 14)
  onClick?: (e: React.MouseEvent) => void;
  onDiamondMouseDown?: (e: React.MouseEvent) => void;
  opacity?: number;
  isSelected?: boolean;
  isSynced?: boolean;
}

const DEFAULT_LANE_H = 18;
const DEFAULT_DIAMOND = 10;
const DEFAULT_LABEL_H = 14;

export function MilestoneFlag({
  centerX,
  rowY,
  rowH,
  side,
  level,
  label,
  color,
  laneH = DEFAULT_LANE_H,
  diamondSize = DEFAULT_DIAMOND,
  labelH = DEFAULT_LABEL_H,
  onClick,
  onDiamondMouseDown,
  opacity = 1,
  isSelected = false,
  isSynced = false,
}: MilestoneFlagProps) {
  const halfDiamond = diamondSize / 2;
  const rowCenterY = rowY + rowH / 2;

  // Diamond is at the center of the row
  const diamondTop = rowCenterY - halfDiamond;

  // Flag is laneH * (level+1) away from diamond, in the "side" direction
  const flagOffset = laneH * (level + 1);
  const flagTop =
    side === "above"
      ? rowCenterY - halfDiamond - flagOffset - labelH
      : rowCenterY + halfDiamond + flagOffset;

  // Leader line connects diamond edge to flag edge
  const leaderTop =
    side === "above" ? flagTop + labelH : rowCenterY + halfDiamond;
  const leaderHeight =
    side === "above"
      ? rowCenterY - halfDiamond - (flagTop + labelH)
      : flagTop - (rowCenterY + halfDiamond);

  // Estimate flag width
  const estW = Math.max(36, label.length * 6.0 + 16);
  const flagLeft = centerX - estW / 2;

  return (
    <div style={{ opacity }}>
      {/* Diamond */}
      <div
        onClick={onClick}
        onMouseDown={onDiamondMouseDown}
        style={{
          position: "absolute",
          left: centerX - halfDiamond,
          top: diamondTop,
          width: diamondSize,
          height: diamondSize,
          background: color,
          transform: "rotate(45deg)",
          zIndex: 4,
          borderRadius: 2,
          flexShrink: 0,
          cursor: onDiamondMouseDown ? "grab" : (onClick ? "pointer" : "default"),
          pointerEvents: "auto",
          boxShadow: isSelected ? "0 0 0 2px #ffffff, 0 0 0 3.5px #3B82F6" : undefined,
        }}
        aria-hidden
      />

      {/* Leader line */}
      {leaderHeight > 0 && (
        <div
          style={{
            position: "absolute",
            left: centerX - 0.5,
            top: leaderTop,
            width: 1,
            height: leaderHeight,
            background: color,
            opacity: 0.5,
            zIndex: 3,
          }}
          aria-hidden
        />
      )}

      {/* Flag chip */}
      <div
        onClick={onClick}
        style={{
          position: "absolute",
          left: flagLeft,
          top: flagTop,
          height: labelH,
          minWidth: 36,
          background: color,
          color: "#ffffff",
          fontSize: 9.5,
          fontWeight: 700,
          fontFamily: "var(--font-display, system-ui)",
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          paddingLeft: 4,
          paddingRight: 4,
          whiteSpace: "nowrap",
          overflow: "visible",
          zIndex: 4,
          letterSpacing: "0.01em",
          cursor: onClick ? "pointer" : "default",
          transition: "filter 120ms",
          pointerEvents: "auto",
        }}
        title={label}
        onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.15)"; } : undefined}
        onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLElement).style.filter = ""; } : undefined}
      >
        {label}
        {isSynced && (
          <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.8 }} aria-label="Synchronisé">⇄</span>
        )}
      </div>
    </div>
  );
}

export default MilestoneFlag;
