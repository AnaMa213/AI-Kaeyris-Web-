import SessionProvider from "@/lib/core/session/SessionProvider";

export default function JdrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
