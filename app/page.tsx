import Link from "next/link";

export default function HomePage() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-display text-4xl font-semibold">AI-Kaeyris</h1>
      <p className="font-serif text-text-chrome-muted max-w-xl text-lg italic">
        Le récit dort dans le bundle ; les fontes sont chargées et les tokens
        OKLCH sont en place.
      </p>
      <p className="font-sans text-text-chrome-muted text-sm">
        Module Launcher arrives in Story 1.8.
      </p>
      <Link
        href="/login"
        className="text-accent-gold hover:underline font-sans text-sm"
      >
        Se connecter
      </Link>
      <code className="font-mono text-xs">npm run dev</code>
    </main>
  );
}
