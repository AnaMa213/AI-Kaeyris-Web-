import type { Metadata } from "next";
import { Crimson_Pro, EB_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import QueryProvider from "@/providers/QueryProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-narrative",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-display",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-chrome",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-technical",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AI-Kaeyris",
  description: "Portail personnel pour ton workflow JDR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${crimsonPro.variable} ${ebGaramond.variable} ${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
