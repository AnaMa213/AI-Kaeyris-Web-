"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { UserDeactivateConfirm } from "@/components/jdr/users/UserDeactivateConfirm";
import { UserForm } from "@/components/jdr/users/UserForm";
import { UsersTable } from "@/components/jdr/users/UsersTable";
import { ApiError } from "@/lib/core/api/errors";
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
  type UserOut,
} from "@/lib/jdr/users/queries";

export default function UsersPage() {
  const usersQuery = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserOut | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<UserOut | null>(null);

  const formErrorMessage = (() => {
    const error = creating ? createMutation.error : updateMutation.error;
    if (!error) return null;
    if (error instanceof ApiError) return error.problem.title;
    return error.message;
  })();

  const deleteErrorMessage = (() => {
    const error = deleteMutation.error;
    if (!error) return null;
    if (error instanceof ApiError) return error.problem.title;
    return error.message;
  })();

  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <header className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Utilisateurs</h1>
          <p className="text-text-chrome-muted mt-1 text-sm">
            Gère les comptes MJ et Joueur de ton portail.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          Nouveau compte
        </Button>
      </header>

      <section className="mx-auto max-w-5xl">
        {usersQuery.isPending && (
          <FantasyLoader message="Consultation du grimoire des comptes..." />
        )}

        {usersQuery.isError && (
          <div
            role="alert"
            className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
          >
            <p className="font-medium">Impossible de charger les comptes.</p>
            {usersQuery.error instanceof ApiError && (
              <p className="text-text-chrome-muted mt-2 text-xs">
                {usersQuery.error.problem.title}
                {usersQuery.error.problem.status === 403
                  ? " — vérifie que ton compte a bien le profil MJ."
                  : null}
              </p>
            )}
          </div>
        )}

        {usersQuery.data && usersQuery.data.items.length === 0 && (
          <div
            role="status"
            className="border-border-chrome bg-surface-raised flex flex-col items-center gap-4 rounded-md border px-8 py-16 text-center"
          >
            <p className="font-display text-2xl">Aucun compte créé</p>
            <p className="text-text-chrome-muted text-sm">
              Tu es seul à régner sur le grimoire.
            </p>
            <Button type="button" onClick={() => setCreating(true)}>
              Nouveau compte
            </Button>
          </div>
        )}

        {usersQuery.data && usersQuery.data.items.length > 0 && (
          <UsersTable
            users={usersQuery.data.items}
            onEdit={setEditingUser}
            onDelete={setDeactivatingUser}
          />
        )}
      </section>

      <UserForm
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) createMutation.reset();
        }}
        mode="create"
        submitting={createMutation.isPending}
        errorMessage={formErrorMessage}
        onSubmit={(payload) => {
          if (payload.mode !== "create") return;
          createMutation.mutate(payload.values, {
            onSuccess: () => {
              setCreating(false);
            },
          });
        }}
      />

      <UserForm
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUser(null);
            updateMutation.reset();
          }
        }}
        mode="edit"
        user={editingUser ?? undefined}
        submitting={updateMutation.isPending}
        errorMessage={formErrorMessage}
        onSubmit={(payload) => {
          if (payload.mode !== "edit") return;
          updateMutation.mutate(
            { id: payload.id, body: payload.values },
            {
              onSuccess: () => setEditingUser(null),
            },
          );
        }}
      />

      <UserDeactivateConfirm
        open={deactivatingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivatingUser(null);
            deleteMutation.reset();
          }
        }}
        user={deactivatingUser}
        submitting={deleteMutation.isPending}
        errorMessage={deleteErrorMessage}
        onConfirm={(userId) => {
          deleteMutation.mutate(userId, {
            onSuccess: () => setDeactivatingUser(null),
          });
        }}
      />
    </main>
  );
}
