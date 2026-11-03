import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <RequireAuth>{children}</RequireAuth>
    </AppShell>
  );
}
