"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  LayoutDashboard,
  Library,
  Scroll,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetCampaign } from "@/lib/jdr/campaigns/queries";

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

// Story 4.23 (AC7) — a `/jdr/campaigns/{campId}/...` route switches the sidebar
// into that campaign's context. `new` is the create route, not a campaign id.
const CAMPAIGN_ROUTE = /^\/jdr\/campaigns\/([^/]+)/;
const SECTION_DISABLED_HINT = "Disponible plus tard";

// Sections « à venir » de la campagne (pas encore de route dédiée → désactivées).
const CAMPAIGN_SECTION_PLACEHOLDERS: Array<{ label: string; icon: LucideIcon }> =
  [
    { label: "PJs", icon: Users },
    { label: "Lore", icon: Scroll },
  ];

const SECTION_BASE_CLASSES =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors";

/**
 * Story 4.23 (AC7) — vue « drill-in » : quand une campagne est sélectionnée, la
 * barre latérale devient le contexte de CETTE campagne — un bouton « Toutes les
 * campagnes » en haut, le nom de la campagne en titre, puis la liste de ses
 * sections (Vue d'ensemble + placeholders PJs/Lore). Conservée en mode replié,
 * où elle se réduit aux icônes (nom accessible via `aria-label`/`title`). Isolé
 * en enfant pour que `useGetCampaign` ne se monte que sur les routes campagne.
 */
function CampaignDrilldownNav({
  campId,
  pathname,
  collapsed,
}: {
  campId: string;
  pathname: string;
  collapsed: boolean;
}) {
  const campaignQuery = useGetCampaign(campId);
  const name =
    campaignQuery.data?.name ?? (campaignQuery.isError ? "Campagne" : "…");

  const overviewHref = `/jdr/campaigns/${campId}`;
  const overviewActive =
    pathname === overviewHref || pathname.startsWith(`${overviewHref}/`);

  return (
    <div className="flex flex-col gap-3">
      {/* Retour vers la liste de toutes les campagnes. */}
      <Link
        href="/jdr/campaigns"
        aria-label="Toutes les campagnes"
        title={collapsed ? "Toutes les campagnes" : undefined}
        className={cn(
          "text-text-chrome hover:bg-surface-overlay hover:text-accent-gold flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-2",
        )}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && <span>Toutes les campagnes</span>}
      </Link>

      {/* Titre de la campagne courante (déplié uniquement). */}
      {!collapsed && (
        <div className="px-3">
          <p className="text-text-chrome-muted text-[0.7rem] font-medium tracking-wide uppercase">
            Campagne
          </p>
          <p
            className="font-display text-text-chrome truncate text-sm font-semibold"
            title={name}
          >
            {name}
          </p>
        </div>
      )}

      {/* Sections de la campagne. */}
      <div className="flex flex-col gap-0.5">
        <Link
          href={overviewHref}
          aria-current={overviewActive ? "page" : undefined}
          aria-label={collapsed ? "Vue d'ensemble" : undefined}
          title={collapsed ? "Vue d'ensemble" : undefined}
          className={cn(
            SECTION_BASE_CLASSES,
            collapsed && "justify-center px-2",
            overviewActive
              ? "bg-surface-overlay text-accent-gold border-accent-gold border-l-2"
              : "text-text-chrome hover:bg-surface-overlay",
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Vue d&apos;ensemble</span>}
        </Link>

        {CAMPAIGN_SECTION_PLACEHOLDERS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled
            aria-disabled="true"
            aria-label={collapsed ? label : undefined}
            title={
              collapsed ? `${label} — ${SECTION_DISABLED_HINT}` : SECTION_DISABLED_HINT
            }
            className={cn(
              SECTION_BASE_CLASSES,
              "text-text-chrome-muted/60 cursor-not-allowed text-left",
              collapsed && "justify-center px-2",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SidebarNavProps {
  collapsed?: boolean;
}

export function SidebarNav({ collapsed = false }: SidebarNavProps) {
  const pathname = usePathname();
  const campMatch = pathname.match(CAMPAIGN_ROUTE);
  const activeCampId =
    campMatch && campMatch[1] !== "new" ? campMatch[1] : undefined;

  // Drill-in : en contexte campagne, la barre est dédiée à la campagne courante
  // (retour + sections), y compris en mode replié (icônes seules).
  if (activeCampId) {
    return (
      <nav aria-label="Navigation JDR" className="flex flex-col gap-1 px-2">
        <CampaignDrilldownNav
          campId={activeCampId}
          pathname={pathname}
          collapsed={collapsed}
        />
      </nav>
    );
  }

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
