"use client";

import { useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { CampaignBreadcrumb } from "@/components/jdr/campaigns/CampaignBreadcrumb";
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
  const params = useParams<{ campId: string }>();
  const router = useRouter();
  const createMutation = useCreateSession();
  const createInFlightRef = useRef(false);

  const campId = typeof params.campId === "string" ? params.campId : "";
  const errorMessage = formatCreateError(createMutation.error);

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <div className="mx-auto mb-4 max-w-2xl">
        <CampaignBreadcrumb campaignId={campId} />
      </div>

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
            if (createInFlightRef.current) return;
            if (!campId) return;
            createInFlightRef.current = true;
            createMutation.mutate(
              { ...values, campaign_id: campId },
              {
                onSuccess: (data) => {
                  router.push(`/jdr/campaigns/${campId}/sessions/${data.id}`);
                },
                onSettled: () => {
                  createInFlightRef.current = false;
                },
              },
            );
          }}
          onCancel={() => router.push(`/jdr/campaigns/${campId}`)}
          submitting={createMutation.isPending}
          errorMessage={errorMessage}
        />
      </section>
    </section>
  );
}
