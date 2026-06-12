"use client";

import { useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { CampaignBreadcrumb } from "@/components/jdr/campaigns/CampaignBreadcrumb";
import { NewSessionForm } from "@/components/jdr/sessions/NewSessionForm";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/core/api/errors";
import { canCreateCampaignSession } from "@/lib/jdr/campaigns/permissions";
import { useGetCampaign } from "@/lib/jdr/campaigns/queries";
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
  const campaignQuery = useGetCampaign(campId);
  const canCreateSession = campaignQuery.data
    ? canCreateCampaignSession(campaignQuery.data)
    : false;
  const errorMessage = formatCreateError(createMutation.error);

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <div className="mb-4">
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
        {campaignQuery.isPending ? (
          <p role="status" className="text-text-chrome-muted text-sm">
            Vérification des droits de campagne...
          </p>
        ) : campaignQuery.isError ? (
          <div
            role="alert"
            className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
          >
            <p className="font-medium">Campagne introuvable.</p>
            {campaignQuery.error instanceof ApiError && (
              <p className="text-text-chrome-muted mt-2 text-xs">
                {campaignQuery.error.problem.title}
              </p>
            )}
          </div>
        ) : !canCreateSession ? (
          <div
            role="alert"
            className="border-border-chrome bg-surface-raised rounded-md border p-4 text-sm"
          >
            <p className="font-medium">
              Seul le MJ de cette campagne peut créer une session.
            </p>
            <p className="text-text-chrome-muted mt-2">
              Les joueurs peuvent consulter les sessions existantes depuis le
              détail de campagne.
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={() => router.push(`/jdr/campaigns/${campId}`)}
            >
              Retour à la campagne
            </Button>
          </div>
        ) : (
          <NewSessionForm
            onSubmit={(values) => {
              if (createInFlightRef.current) return;
              if (!campId) return;
              createInFlightRef.current = true;
              createMutation.mutate(
                { ...values, campaign_id: campId },
                {
                  onSuccess: (data) => {
                    router.push(
                      `/jdr/campaigns/${campId}/sessions/${data.id}`,
                    );
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
        )}
      </section>
    </section>
  );
}
