"use client";

import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useLogout } from "@/lib/core/auth/useLogout";
import { useUIStore } from "@/lib/core/stores/ui";
import { Lockup } from "@/components/jdr/layout/Lockup";
import { SidebarNav } from "@/components/jdr/layout/SidebarNav";

export function Sidebar() {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggle = useUIStore((state) => state.toggleSidebarCollapsed);
  const logout = useLogout();

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "bg-surface-raised border-border-chrome flex h-full flex-col border-r",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <Lockup collapsed={collapsed} />
        {!collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-expanded={true}
            aria-label="Replier la barre latérale"
            className="text-text-chrome-muted h-7 w-7 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-expanded={false}
            aria-label="Déplier la barre latérale"
            className="text-text-chrome-muted h-7 w-7"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <Separator className="bg-border-chrome mt-1" />

      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav collapsed={collapsed} />
      </div>

      <Separator className="bg-border-chrome" />

      <div className="flex flex-col gap-1 px-2 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          aria-disabled="true"
          title="Disponible plus tard"
          aria-label={collapsed ? "Settings" : undefined}
          className={cn(
            "text-text-chrome-muted/60 justify-start gap-3",
            collapsed && "justify-center",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Settings</span>}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Se déconnecter"
          className={cn(
            "text-text-chrome justify-start gap-3",
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
