import SessionProvider from "@/lib/core/session/SessionProvider";
import { AuthGuard } from "@/components/jdr/auth/AuthGuard";
import { Sidebar } from "@/components/jdr/layout/Sidebar";

export default function JdrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AuthGuard>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </AuthGuard>
    </SessionProvider>
  );
}
