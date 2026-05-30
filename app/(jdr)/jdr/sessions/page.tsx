"use client";

import { EmptyState } from "@/components/common/EmptyState";

export default function SessionsPage() {
  return (
    <section className="bg-background text-foreground min-h-screen p-8">
      <header className="mx-auto mb-8 max-w-5xl">
        <h1 className="font-display text-3xl font-semibold">Sessions</h1>
        <p className="text-text-chrome-muted mt-1 text-sm">
          Le grimoire de tes campagnes.
        </p>
      </header>

      <div className="mx-auto max-w-5xl">
        <EmptyState
          title="Aucune session encore."
          description="Crée ta première session pour commencer un récit."
          action={{
            label: "Nouvelle session",
            onClick: () => {},
            disabled: true,
            disabledHint: "Disponible avec Epic 2",
          }}
        />
      </div>
    </section>
  );
}
