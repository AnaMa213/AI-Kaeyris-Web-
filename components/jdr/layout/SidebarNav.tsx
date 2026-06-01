"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledHint?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Campagnes", href: "/jdr/campaigns", icon: Library },
];

interface SidebarNavProps {
  collapsed?: boolean;
}

export function SidebarNav({ collapsed = false }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation JDR" className="flex flex-col gap-1 px-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
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
