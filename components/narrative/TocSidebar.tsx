"use client";

import { useEffect, useState } from "react";
import { ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Story 5.2 — sommaire flottant (table des matières) avec scrollspy.
 *
 * Overlay de navigation purement présentationnel : il NE fetch rien et NE parse
 * PAS le Markdown. Il dérive ses entrées des titres `h2`/`h3` déjà rendus par
 * `NarrativeArtifact` (Story 5.1) — dont les `id` déterministes viennent de
 * `rehype-slug`. On lit ces ids tels quels (architecture §6 : « Client overlay
 * reads the rendered DOM ») ; surtout ne PAS re-slugger (risque de drift, et
 * `github-slugger` n'est pas une dépendance directe).
 *
 * Piège cadré (story §Divergence 2) : le scroll vit dans `<main overflow-y-auto>`
 * du layout JDR, pas sur `window`. Le scrollspy cale donc l'IntersectionObserver
 * sur ce conteneur (résolu via le plus proche ancêtre scrollable), et le rail est
 * `sticky` relativement à lui.
 */

interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TocSidebarProps {
  /** Élément contenant l'`<article>` rendu par `NarrativeArtifact`. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Déclencheur de re-scan : change quand le Markdown rendu change (régénération). */
  contentKey: string;
  className?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Remonte les ancêtres jusqu'au premier conteneur scrollable (sinon viewport). */
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function getHeadingEl(root: HTMLElement | null, id: string): HTMLElement | null {
  return root?.querySelector<HTMLElement>(`[id="${id}"]`) ?? null;
}

export function TocSidebar({
  containerRef,
  contentKey,
  className,
}: TocSidebarProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // AC1/AC2/AC6 — dérive les titres h2/h3 du DOM rendu, dans l'ordre du document.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      setHeadings([]);
      return;
    }
    const nodes = root.querySelectorAll<HTMLElement>("h2[id], h3[id]");
    const next: TocHeading[] = [];
    nodes.forEach((node) => {
      const text = node.textContent?.trim() ?? "";
      if (!node.id || !text) return;
      next.push({ id: node.id, text, level: node.tagName === "H3" ? 3 : 2 });
    });
    setHeadings(next);
  }, [containerRef, contentKey]);

  // AC3 — scrollspy : surligne le titre en haut de la zone de lecture. L'observer
  // cale son `root` sur le conteneur de scroll réel ; entre deux sections (aucun
  // titre intersectant) on conserve le dernier actif (pas de retour à « aucun »).
  useEffect(() => {
    if (headings.length < 2) return;
    const root = containerRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const visibility = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.isIntersecting);
        }
        const firstVisible = headings.find((heading) =>
          visibility.get(heading.id),
        );
        if (firstVisible) setActiveId(firstVisible.id);
      },
      {
        root: findScrollParent(root),
        rootMargin: "0px 0px -70% 0px",
        threshold: 0,
      },
    );

    const observed = headings
      .map((heading) => getHeadingEl(root, heading.id))
      .filter((el): el is HTMLElement => el !== null);
    observed.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [headings, containerRef]);

  // AC6 — un sommaire à une seule entrée est du bruit : on ne rend rien.
  if (headings.length < 2) return null;

  // AC4 — scroll doux jusqu'à la section, en respectant prefers-reduced-motion
  // (le `scroll-behavior:auto` CSS ne couvre pas un `behavior` passé explicitement).
  const scrollToHeading = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    const target = getHeadingEl(containerRef.current, id);
    if (!target) return; // laisse l'ancre native faire le fallback
    event.preventDefault();
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    setActiveId(id);
  };

  return (
    <nav
      aria-label="Sommaire"
      className={cn(
        "text-text-chrome-muted self-start text-sm xl:sticky xl:top-6",
        className,
      )}
    >
      {/* AC5 — repli (UX-DR4). Déplié par défaut (Direction B). */}
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="text-text-chrome hover:text-accent-gold focus-visible:ring-accent-gold/60 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide uppercase focus-visible:ring-2 focus-visible:outline-none"
      >
        <List className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Sommaire</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 motion-safe:transition-transform",
            !expanded && "-rotate-90",
          )}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <ol className="border-border-chrome mt-2 space-y-0.5 border-l">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            return (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  aria-current={isActive ? "location" : undefined}
                  onClick={(event) => scrollToHeading(event, heading.id)}
                  className={cn(
                    "hover:text-text-chrome focus-visible:ring-accent-gold/60 -ml-px block border-l py-1 focus-visible:ring-2 focus-visible:outline-none",
                    heading.level === 3 ? "pl-5 text-[0.8125rem]" : "pl-3",
                    isActive
                      ? "border-accent-gold text-accent-gold font-medium"
                      : "border-transparent",
                  )}
                >
                  {heading.text}
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
