"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScrollText,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledHint?: string;
  gmOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Sessions", href: "/jdr/sessions", icon: ScrollText },
  {
    label: "PJs",
    href: "/jdr/pjs",
    icon: UserCircle,
    disabled: true,
    disabledHint: "Disponible plus tard",
    gmOnly: true,
  },
  { label: "Utilisateurs", href: "/jdr/users", icon: Users, gmOnly: true },
];

interface SidebarNavProps {
  collapsed?: boolean;
}

export function SidebarNav({ collapsed = false }: SidebarNavProps) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const isGm =
    user.status === "authenticated" && user.jdr.role === "gm";

  const visibleItems = NAV_ITEMS.filter((item) => !item.gmOnly || isGm);

  return (
    <nav aria-label="Navigation JDR" className="flex flex-col gap-1 px-2">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        const baseClasses = cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          collapsed && "justify-center px-2",
          item.disabled
            ? "text-text-chrome-muted/60 cursor-not-allowed"
            : "text-text-chrome hover:bg-surface-overlay",
          isActive &&
            "bg-surface-overlay text-accent-gold border-accent-gold border-l-2",
        );

        if (item.disabled) {
          return (
            <button
              key={item.href}
              type="button"
              disabled
              aria-disabled="true"
              title={item.disabledHint}
              aria-label={collapsed ? item.label : undefined}
              className={baseClasses}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={baseClasses}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
