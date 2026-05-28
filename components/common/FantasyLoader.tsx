interface FantasyLoaderProps {
  message?: string;
}

export function FantasyLoader({
  message = "Consultation du grimoire...",
}: FantasyLoaderProps) {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={message}
      className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-8 p-8"
    >
      <div className="relative h-24 w-24" aria-hidden="true">
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="text-accent-gold h-full w-full animate-[spin_3s_linear_infinite] drop-shadow-[0_0_8px_rgba(212,175,55,0.35)] motion-reduce:animate-none"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* D20 (icosahedron) — outer hexagonal silhouette */}
          <polygon
            points="50,6 90,28 90,72 50,94 10,72 10,28"
            strokeWidth="2.5"
          />
          {/* Inner faces hint */}
          <polygon points="50,6 90,28 50,50 10,28" strokeWidth="1" opacity="0.5" />
          <polygon
            points="50,50 90,28 90,72 50,94 10,72 10,28"
            strokeWidth="0.6"
            opacity="0.3"
          />
          {/* The iconic 20 */}
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontSize="22"
            fontWeight="700"
            fill="currentColor"
            stroke="none"
            style={{ fontFamily: "var(--font-serif-display, serif)" }}
          >
            20
          </text>
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-serif text-text-chrome-muted text-sm italic">
          {message}
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="bg-accent-gold h-1.5 w-1.5 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full motion-reduce:animate-none" />
          <span className="bg-accent-gold h-1.5 w-1.5 animate-[pulse_1.4s_ease-in-out_0.2s_infinite] rounded-full motion-reduce:animate-none" />
          <span className="bg-accent-gold h-1.5 w-1.5 animate-[pulse_1.4s_ease-in-out_0.4s_infinite] rounded-full motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}
