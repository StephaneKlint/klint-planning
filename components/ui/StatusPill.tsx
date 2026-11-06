/**
 * StatusPill — colored dot + label for phase statuses.
 * Colors resolved from CSS variables --st-{code}-c / --st-{code}-bg.
 */

export type StatusCode = "planned" | "in_progress" | "review" | "done" | "risk" | "late";

const STATUS_LABELS: Record<StatusCode, string> = {
  planned:     "Planifié",
  in_progress: "En cours",
  review:      "En attente validation QA",
  done:        "Terminé",
  risk:        "À risque",
  late:        "En retard",
};

interface StatusPillProps {
  status: StatusCode;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  const displayLabel = label ?? STATUS_LABELS[status] ?? status;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px 2px 6px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        background: `var(--st-${status}-bg, #F1F5F9)`,
        color: `var(--st-${status}-c, #94A3B8)`,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: `var(--st-${status}-c, #94A3B8)`,
          flexShrink: 0,
        }}
      />
      {displayLabel}
    </span>
  );
}

export default StatusPill;
