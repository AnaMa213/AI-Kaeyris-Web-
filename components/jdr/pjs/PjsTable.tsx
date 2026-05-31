"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { PjOut } from "@/lib/jdr/pjs/queries";

interface PjsTableProps {
  pjs: PjOut[];
}

export function PjsTable({ pjs }: PjsTableProps) {
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
        </tr>
      </thead>
      <tbody className="divide-border-chrome divide-y">
        {pjs.map((pj) => (
          <tr key={pj.id}>
            <td className="px-4 py-3 font-medium">{pj.name}</td>
            <td className="text-text-chrome-muted px-4 py-3 text-sm">
              {format(new Date(pj.created_at), "dd/MM/yyyy", { locale: fr })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
