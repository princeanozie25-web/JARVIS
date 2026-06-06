export type CommandCenterRouteId =
  | "home"
  | "rest"
  | "working"
  | "audit"
  | "pipeline";

export const COMMAND_CENTER_ROUTES = Object.freeze([
  {
    id: "home",
    href: "/",
    label: "Core",
    compactLabel: "Core",
    summary: "pipeline presence",
  },
  {
    id: "rest",
    href: "/rest",
    label: "Rest",
    compactLabel: "Rest",
    summary: "standing by",
  },
  {
    id: "working",
    href: "/working",
    label: "Working",
    compactLabel: "Work",
    summary: "governed work",
  },
  {
    id: "audit",
    href: "/audit",
    label: "Audit",
    compactLabel: "Audit",
    summary: "forensic proof",
  },
  {
    id: "pipeline",
    href: "/audit/pipeline",
    label: "Pipeline",
    compactLabel: "Pipe",
    summary: "sole UI spine",
  },
] as const);

export interface CommandCenterNavProps {
  active: CommandCenterRouteId;
  compact?: boolean;
  className?: string;
}

export function CommandCenterNav({
  active,
  compact = false,
  className = "",
}: CommandCenterNavProps) {
  return (
    <nav
      aria-label="Command center routes"
      data-command-center-nav="unified"
      className={`cc-route-nav ${compact ? "cc-route-nav-compact" : ""} ${className}`}
    >
      {COMMAND_CENTER_ROUTES.map((route) => (
        <a
          key={route.id}
          href={route.href}
          data-command-center-route-link={route.id}
          data-active={String(route.id === active)}
          className="cc-route-link"
        >
          <span>{compact ? route.compactLabel : route.label}</span>
          {compact ? null : <small>{route.summary}</small>}
        </a>
      ))}
    </nav>
  );
}
