"use client";

import { useRouter } from "next/navigation";
import { NewSessionForm } from "@/components/jdr/sessions/NewSessionForm";
import { ApiError } from "@/lib/core/api/errors";
import { useCreateSession } from "@/lib/jdr/sessions/queries";

function formatCreateError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    return "Création impossible. Vérifie les informations saisies.";
  }
  if (error instanceof Error) return error.message;
  return null;
}

export default function NewSessionPage() {
  const router = useRouter();
  const createMutation = useCreateSession();

  const errorMessage = formatCreateError(createMutation.error);

  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <header className="mx-auto mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">
          Nouvelle session
        </h1>
        <p className="text-text-chrome-muted mt-1 text-sm">
          Saisis le titre et la date de la séance. L&apos;audio s&apos;upload
          ensuite dans le détail.
        </p>
      </header>

      <section className="mx-auto max-w-2xl">
        <NewSessionForm
          onSubmit={(values) => {
            createMutation.mutate(values, {
              onSuccess: (data) => {
                router.push(`/jdr/sessions/${data.id}`);
              },
            });
          }}
          onCancel={() => router.push("/jdr/sessions")}
          submitting={createMutation.isPending}
          errorMessage={errorMessage}
        />
      </section>
    </main>
  );
}
