"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { IconButton } from "@/components/common/IconButton";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { CampaignBreadcrumb } from "@/components/jdr/campaigns/CampaignBreadcrumb";
import { CampaignDeleteConfirm } from "@/components/jdr/campaigns/CampaignDeleteConfirm";
import { CampaignEditDialog } from "@/components/jdr/campaigns/CampaignEditDialog";
import { CampaignPjsCard } from "@/components/jdr/campaigns/CampaignPjsCard";
import { SessionLibrary } from "@/components/jdr/sessions/SessionLibrary";
import { ApiError } from "@/lib/core/api/errors";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import {
  canCreateCampaignSession,
  canDeleteCampaign,
  canEditCampaign,
} from "@/lib/jdr/campaigns/permissions";
import {
  useDeleteCampaign,
  useGetCampaign,
} from "@/lib/jdr/campaigns/queries";
import { useListSessions } from "@/lib/jdr/sessions/queries";

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

export default function CampaignDetailPage() {
  const params = useParams<{ campId: string }>();
  const router = useRouter();
  const campId = typeof params.campId === "string" ? params.campId : "";

  const campaignQuery = useGetCampaign(campId);
  const sessionsQuery = useListSessions({ campaignId: campId });
  const deleteMutation = useDeleteCampaign(campId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (campaignQuery.isPending) {
    return <FantasyLoader message="Consultation du grimoire..." />;
  }

  if (campaignQuery.isError) {
    return (
      <section className="bg-background text-foreground min-h-full px-6 py-8 lg:px-12">
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
      </section>
    );
  }

  const campaign = campaignQuery.data;
  const createdAt = parseBackendDate(campaign.created_at);
  const createdLabel = format(createdAt, "dd/MM/yyyy", { locale: fr });
  const canCreateSession = canCreateCampaignSession(campaign);
  const canEdit = canEditCampaign(campaign);
  const canDelete = canDeleteCampaign(campaign);
  const sessions = sessionsQuery.data?.items ?? [];

  const handleConfirmDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setDeleting(false);
        router.push("/jdr/campaigns");
      },
    });
  };

  return (
    <section className="bg-background text-foreground min-h-full px-6 py-8 lg:px-12">
      {/* Story 4.23 (AC8) — fil d'Ariane cohérent (remplace l'ancien back-link). */}
      <div className="mb-4">
        <CampaignBreadcrumb campaignId={campId} />
      </div>

      <header
        className={`${SECTION_CARD_CLASSES} mb-7 lg:p-8`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold leading-tight">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="font-narrative text-text-chrome-muted mt-2 max-w-[70ch] text-base italic">
                {campaign.description}
              </p>
            )}
            <p className="text-text-chrome-muted mt-3 text-sm">
              <strong className="text-text-chrome font-medium">
                {campaign.session_count}
              </strong>{" "}
              {campaign.session_count <= 1 ? "session" : "sessions"} · démarrée
              le {createdLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <IconButton
                label="Modifier la campagne"
                icon={<Pencil aria-hidden="true" />}
                onClick={() => setEditing(true)}
              />
            )}
            {canDelete && (
              <IconButton
                label="Supprimer la campagne"
                icon={<Trash2 aria-hidden="true" />}
                onClick={() => setDeleting(true)}
                className="text-state-error-strong hover:text-state-error-strong! hover:bg-state-error/10!"
              />
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
        <section
          aria-label="Sessions"
          className={`${SECTION_CARD_CLASSES} lg:col-span-2`}
        >
          {sessionsQuery.isPending ? (
            <p className="text-text-chrome-muted text-sm">
              Chargement des sessions...
            </p>
          ) : sessionsQuery.isError ? (
            <div
              role="alert"
              className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
            >
              <p className="font-medium">
                Les sessions de cette campagne n&apos;ont pas pu être chargées.
              </p>
              {sessionsQuery.error instanceof ApiError && (
                <p className="text-text-chrome-muted mt-2 text-xs">
                  {sessionsQuery.error.problem.title}
                </p>
              )}
            </div>
          ) : (
            <SessionLibrary
              sessions={sessions}
              campId={campId}
              canCreateSession={canCreateSession}
            />
          )}
        </section>

        <aside className="flex flex-col gap-5 lg:col-span-1">
          <CampaignPjsCard campaign={campaign} />
        </aside>
      </div>

      <CampaignEditDialog
        open={editing}
        onOpenChange={setEditing}
        campaign={campaign}
      />
      <CampaignDeleteConfirm
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) deleteMutation.reset();
        }}
        campaign={campaign}
        onConfirm={handleConfirmDelete}
        submitting={deleteMutation.isPending}
        error={deleteMutation.error}
      />
    </section>
  );
}
