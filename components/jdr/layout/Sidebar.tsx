"use client";

import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useLogout } from "@/lib/core/auth/useLogout";
import { isSystemAdmin } from "@/lib/core/session/helpers";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";
import { useUIStore } from "@/lib/core/stores/ui";
import { Lockup } from "@/components/jdr/layout/Lockup";
import { SidebarNav } from "@/components/jdr/layout/SidebarNav";

const chevronClasses =
  "text-text-chrome-muted hover:!bg-surface-overlay hover:!text-accent-gold h-7 w-7 shrink-0";

const footerButtonBase =
  "justify-start gap-3 hover:!bg-surface-overlay hover:!text-accent-gold";

export function Sidebar() {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggle = useUIStore((state) => state.toggleSidebarCollapsed);
  const logout = useLogout();
  const user = useCurrentUser();
  const router = useRouter();
  const isAdmin = isSystemAdmin(user);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "bg-surface-raised border-border-chrome flex h-full flex-col border-r",
        collapsed ? "w-20" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center py-3",
          collapsed ? "justify-between gap-1 px-2" : "justify-between gap-2 px-3",
        )}
      >
        <Lockup collapsed={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? "Déplier la barre latérale"
              : "Replier la barre latérale"
          }
          className={chevronClasses}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      <Separator className="bg-border-chrome" />

      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav collapsed={collapsed} />
      </div>

      <Separator className="bg-border-chrome" />

      <div className="flex flex-col gap-1 px-2 py-3">
        {isAdmin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/jdr/settings")}
            aria-label={collapsed ? "Settings" : undefined}
            className={cn(
              "text-text-chrome",
              footerButtonBase,
              collapsed && "justify-center",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Settings</span>}
          </Button>
        )}

        {isAdmin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/jdr/users")}
            aria-label={collapsed ? "Utilisateurs" : undefined}
            className={cn(
              "text-text-chrome",
              footerButtonBase,
              collapsed && "justify-center",
            )}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Utilisateurs</span>}
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Se déconnecter"
          className={cn(
            "text-text-chrome",
            footerButtonBase,
            collapsed && "justify-center",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && (
            <span>
              {logout.isPending ? "Déconnexion..." : "Se déconnecter"}
            </span>
          )}
        </Button>
      </div>
    </aside>
  );
}
