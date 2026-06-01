"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserOut } from "@/lib/jdr/users/queries";

interface UsersTableProps {
  users: UserOut[];
  onEdit: (user: UserOut) => void;
  onDelete: (user: UserOut) => void;
}

const systemRoleLabel = (role: UserOut["system_role"]) =>
  role === "admin" ? "Administrateur" : "Utilisateur";

const statusLabel = (status: UserOut["status"]) => {
  switch (status) {
    case "active":
      return "Actif";
    case "inactive":
      return "Inactif";
    case "deleted":
      return "Supprimé";
  }
};

export function UsersTable({ users, onEdit, onDelete }: UsersTableProps) {
  return (
    <table className="divide-border-chrome min-w-full divide-y">
      <thead>
        <tr className="text-text-chrome-muted text-left text-xs uppercase">
          <th className="px-4 py-3 font-medium">Nom d&apos;utilisateur</th>
          <th className="px-4 py-3 font-medium">Rôle système</th>
          <th className="px-4 py-3 font-medium">Statut</th>
          <th className="px-4 py-3 font-medium">Créé</th>
          <th className="px-4 py-3 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-border-chrome divide-y">
        {users.map((user) => (
          <tr key={user.id}>
            <td className="px-4 py-3 font-medium">{user.username}</td>
            <td className="px-4 py-3">
              <Badge
                className={
                  user.system_role === "admin"
                    ? "bg-accent-gold/10 text-accent-gold border-accent-gold/30"
                    : "bg-surface-overlay text-text-chrome-muted border-border-chrome"
                }
              >
                {systemRoleLabel(user.system_role)}
              </Badge>
            </td>
            <td
              className={
                user.status === "active"
                  ? undefined
                  : "text-text-chrome-muted"
              }
            >
              <span className="px-4 py-3">{statusLabel(user.status)}</span>
            </td>
            <td className="text-text-chrome-muted px-4 py-3 text-sm">
              {format(new Date(user.created_at), "dd/MM/yyyy", { locale: fr })}
            </td>
            <td className="flex gap-2 px-4 py-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onEdit(user)}
              >
                Modifier
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onDelete(user)}
                className="text-state-error hover:text-state-error"
              >
                Désactiver
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
