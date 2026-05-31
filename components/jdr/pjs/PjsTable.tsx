"use client";

import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { MockBadge } from "@/components/common/MockBadge";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import type { PjOut } from "@/lib/jdr/pjs/queries";

interface PjsTableProps {
  pjs: PjOut[];
  onDelete: (pj: PjOut) => void;
}

export function PjsTable({ pjs, onDelete }: PjsTableProps) {
  return (
    <table className="divide-border-chrome min-w-full divide-y">
      <thead>
        <tr className="text-text-chrome-muted text-left text-xs uppercase">
          <th scope="col" className="px-4 py-3 font-medium">
            Nom
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Créé
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            <span className="inline-flex items-center gap-2">
              Actions
              <MockBadge tooltip="Suppression locale, non persistée — endpoint backend en attente (BD-3)" />
            </span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-border-chrome divide-y">
        {pjs.map((pj) => {
          const createdAt = parseBackendDate(pj.created_at);
          const absoluteDate = format(createdAt, "dd/MM/yyyy", { locale: fr });
          const relativeDate = formatDistanceToNow(createdAt, {
            addSuffix: true,
            locale: fr,
          });

          return (
            <tr key={pj.id}>
              <td className="px-4 py-3 font-medium">{pj.name}</td>
              <td className="text-text-chrome-muted px-4 py-3 text-sm">
                <time
                  dateTime={pj.created_at}
                  title={absoluteDate}
                  className="flex flex-col gap-1"
                >
                  <span>{relativeDate}</span>
                  <span className="text-xs">{absoluteDate}</span>
                </time>
              </td>
              <td className="px-4 py-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(pj)}
                  aria-label={`Supprimer le PJ ${pj.name}`}
                  className="text-state-error hover:text-state-error! hover:bg-state-error/10!"
                >
                  Supprimer
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
