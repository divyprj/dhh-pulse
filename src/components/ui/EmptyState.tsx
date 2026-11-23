import type { ReactNode } from "react";

/**
 * EmptyState — the honest state.
 *
 * Never a shrug emoji and never "No data". Every empty surface names what is
 * absent, why it is absent, and the next real action the operator can take.
 */
export type EmptyStateIcon = "signal" | "tape" | "search";

export interface EmptyStateProps {
  /** Short uppercase station label, e.g. "NO SNAPSHOTS" */
  eyebrow?: string;
  title: string;
  description: string;
  /** A real control — a link to the sync runbook, a retry button, etc. */
  action?: ReactNode;
  icon?: EmptyStateIcon;
  /** Trim vertical rhythm for use inside a table body. */
  compact?: boolean;
  className?: string;
}

function Glyph({ icon }: { icon: EmptyStateIcon }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (icon === "tape") {
    return (
      <svg {...common}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="1.5" />
        <circle cx="8" cy="12" r="2.6" />
        <circle cx="16" cy="12" r="2.6" />
        <path d="M10.4 15.2h3.2" />
      </svg>
    );
  }

  if (icon === "search") {
    return (
      <svg {...common}>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5" />
        <path d="M8 10.5h5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 14.5h3.2l1.6-4 2.4 7 1.8-9.5 2 6.5 1.6-3 2 3H21" />
    </svg>
  );
}

export function EmptyState({
  eyebrow = "NO DATA",
  title,
  description,
  action,
  icon = "signal",
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-start gap-3 ${
        compact ? "px-4 py-8" : "px-5 py-12 sm:px-8 sm:py-16"
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center border border-hairline bg-riser/60 text-dim">
          <Glyph icon={icon} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
          {eyebrow}
        </span>
      </div>

      <h3 className="max-w-[46ch] text-lg font-medium leading-tight tracking-tight text-chalk">
        {title}
      </h3>
      <p className="max-w-[62ch] text-sm leading-relaxed text-ash">
        {description}
      </p>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
