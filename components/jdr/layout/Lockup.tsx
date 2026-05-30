interface LockupProps {
  collapsed?: boolean;
}

function Sigil({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClasses =
    size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-xl";
  return (
    <span
      aria-hidden="true"
      className={`bg-surface-base border-border-chrome text-accent-gold flex shrink-0 items-center justify-center rounded-full border ${sizeClasses}`}
    >
      ⚔
    </span>
  );
}

export function Lockup({ collapsed = false }: LockupProps) {
  if (collapsed) {
    return (
      <span aria-label="AI-Kaeyris JDR Assistant">
        <Sigil size="sm" />
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Sigil />
      <div className="flex flex-col gap-0.5">
        <span className="text-accent-gold font-display text-lg leading-tight font-semibold">
          AI-Kaeyris
        </span>
        <span className="text-text-chrome-muted font-sans text-xs">
          JDR Assistant
        </span>
      </div>
    </div>
  );
}
