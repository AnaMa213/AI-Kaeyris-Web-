"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampaignsList } from "@/components/jdr/campaigns/CampaignsList";
import { EmptyState } from "@/components/common/EmptyState";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { ApiError } from "@/lib/core/api/errors";
import { useListCampaigns } from "@/lib/jdr/campaigns/queries";

export default function CampaignsPage() {
  const router = useRouter();
  const campaignsQuery = useListCampaigns();

  if (campaignsQuery.isPending) {
    return <FantasyLoader message="Consultation des grimoires..." />;
  }

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <header className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Campagnes</h1>
          <p className="text-text-chrome-muted mt-1 text-sm">
            Tes mondes en cours d&apos;écriture.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => router.push("/jdr/campaigns/new")}
        >
          Nouvelle campagne
        </Button>
      </header>

      <div className="mx-auto max-w-5xl">
        {campaignsQuery.isError && (
          <div
            role="alert"
            className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
          >
            <p className="font-medium">Impossible de charger les campagnes.</p>
            {campaignsQuery.error instanceof ApiError && (
              <p className="text-text-chrome-muted mt-2 text-xs">
                {campaignsQuery.error.problem.title}
              </p>
            )}
          </div>
        )}

        {campaignsQuery.data && campaignsQuery.data.items.length === 0 && (
          <EmptyState
            title="Aucune campagne encore."
            description="Crée ta première campagne pour commencer à organiser tes sessions."
            action={{
              label: "Nouvelle campagne",
              onClick: () => router.push("/jdr/campaigns/new"),
            }}
          />
        )}

        {campaignsQuery.data && campaignsQuery.data.items.length > 0 && (
          <CampaignsList campaigns={campaignsQuery.data.items} />
        )}
      </div>
    </section>
  );
}
