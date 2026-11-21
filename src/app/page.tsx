import { AppProvider } from "@/components/AppProvider";
import { ControlCenter } from "@/components/ControlCenter";

/**
 * Control Center shell for `/`.
 *
 * The page itself is a server component (so metadata and streaming work as
 * usual); every interactive surface below is a client component fed by the
 * single `AppProvider` store.
 */
export default function HomePage() {
  return (
    <AppProvider>
      <ControlCenter />
    </AppProvider>
  );
}