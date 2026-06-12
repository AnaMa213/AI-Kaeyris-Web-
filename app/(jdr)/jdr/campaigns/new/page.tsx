"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/common/BackLink";
import { CampaignForm } from "@/components/jdr/campaigns/CampaignForm";
import { ApiError } from "@/lib/core/api/errors";
import { useCreateCampaign } from "@/lib/jdr/campaigns/queries";

function formatCreateError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    const haystack =
      `${error.problem.type ?? ""} ${error.problem.title ?? ""}`.toLowerCase();
    if (haystack.includes("duplicate")) {
      return "Tu as déjà une campagne avec ce nom.";
    }
    return "Création impossible. Vérifie les informations saisies.";
  }
  if (error instanceof Error) return error.message;
  return null;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const createMutation = useCreateCampaign();
  const createInFlightRef = useRef(false);

  const errorMessage = formatCreateError(createMutation.error);

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <div className="mb-4">
        <BackLink href="/jdr/campaigns" label="Campagnes" />
      </div>
      <header className="mx-auto mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">
          Nouvelle campagne
        </h1>
        <p className="text-text-chrome-muted mt-1 text-sm">
          Donne-lui un nom et une intro narrative.
        </p>
      </header>

      <section className="mx-auto max-w-2xl">
        <CampaignForm
          onSubmit={(values) => {
            if (createInFlightRef.current) return;
            createInFlightRef.current = true;
            createMutation.mutate(values, {
              onSuccess: (data) => {
                router.push(`/jdr/campaigns/${data.id}`);
              },
              onSettled: () => {
                createInFlightRef.current = false;
              },
            });
          }}
          onCancel={() => router.push("/jdr/campaigns")}
          submitting={createMutation.isPending}
          errorMessage={errorMessage}
        />
      </section>
    </section>
  );
}
