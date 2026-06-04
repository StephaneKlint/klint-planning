/**
 * TodayLine — the vertical "today" indicator (mint color + date pin).
 * Absolutely positioned within the timeline body.
 */

interface TodayLineProps {
  x: number;          // px from timeline left
  totalH: number;     // total gantt content height
  date: string;       // "YYYY-MM-DD" for the pin label
}

export function TodayLine({ x, totalH, date }: TodayLineProps) {
  const [, m, d] = date.split("-").map(Number);
  const label = `${d}/${m}`;

  return (
    <>
      {/* Vertical line */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: 2,
          height: totalH,
          background: "var(--klint-mint, #5CD696)",
          opacity: 0.85,
          zIndex: 5,
          pointerEvents: "none",
        }}
        aria-hidden
      />

      {/* Pin at top */}
      <div
        style={{
          position: "absolute",
          left: x - 18,
          top: 0,
          width: 36,
          height: 18,
          background: "var(--klint-mint, #5CD696)",
          color: "var(--klint-navy, #001036)",
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "var(--font-display, system-ui)",
          borderRadius: "0 0 4px 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 6,
          pointerEvents: "none",
          letterSpacing: "0.02em",
        }}
        aria-label={`Aujourd'hui : ${date}`}
      >
        {label}
      </div>
    </>
  );
}

export default TodayLine;
