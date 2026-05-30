"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
      <Lockup collapsed={collapsed} />

      <Separator className="bg-border-chrome" />

      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav collapsed={collapsed} />
      </div>

      <Separator className="bg-border-chrome" />

      <div className="flex flex-col gap-1 px-2 py-3">
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

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"
          }
          className={cn(
            "text-text-chrome-muted justify-start gap-3",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {!collapsed && <span>Replier</span>}
        </Button>
      </div>
    </aside>
  );
}
