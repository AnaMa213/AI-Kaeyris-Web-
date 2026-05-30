import SessionProvider from "@/lib/core/session/SessionProvider";
import { Sidebar } from "@/components/jdr/layout/Sidebar";

export default function JdrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SessionProvider>
  );
}
