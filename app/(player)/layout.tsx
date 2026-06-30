import SessionProvider from "@/lib/core/session/SessionProvider";
import { PlayerGuard } from "@/components/jdr/auth/PlayerGuard";

/**
 * Story 8.4 — dedicated read-only player surface (UX-DR28): mobile-first single
 * column, no grimoire sidebar (distinct from the desktop `(jdr)` Module Shell).
 */
export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <PlayerGuard>
        <div className="bg-surface-base text-text-chrome min-h-screen">
          <header className="border-border-card/60 flex items-baseline gap-2 border-b px-4 py-3">
            <span className="font-display text-accent-gold text-lg font-semibold">
              AI-Kaeyris
            </span>
            <span className="text-text-chrome-muted text-sm">Mes séances</span>
          </header>
          <main className="mx-auto w-full max-w-2xl px-4 py-6">{children}</main>
        </div>
      </PlayerGuard>
    </SessionProvider>
  );
}
