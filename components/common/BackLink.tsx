import Link from "next/link";

interface BackLinkProps {
  href: string;
  label: string;
}

/**
 * Lien de retour « ← {label} » partagé (fil d'Ariane simple). Reprend le motif
 * du détail de campagne pour une navigation cohérente sur les pages sans onglet
 * de sidebar (nouvelle campagne, utilisateurs…).
 */
export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="text-text-chrome-muted hover:bg-accent-gold/10 hover:text-accent-gold -mx-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm transition-all duration-120"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
