interface LockupProps {
  collapsed?: boolean;
}

export function Lockup({ collapsed = false }: LockupProps) {
  if (collapsed) {
    return (
      <div
        aria-label="AI-Kaeyris JDR Assistant"
        className="text-accent-gold font-display flex h-10 w-full items-center justify-center text-lg"
      >
        AK
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-accent-gold font-display text-lg leading-tight font-semibold">
        AI-Kaeyris
      </span>
      <span className="text-text-chrome-muted font-sans text-xs">
        JDR Assistant
      </span>
    </div>
  );
}
