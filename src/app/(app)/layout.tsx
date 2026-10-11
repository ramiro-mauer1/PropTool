import { AppShell } from "@/components/AppShell";

// Layout compartido de toda la app: el shell (barra lateral, barra inferior,
// estado del lote) se monta una vez y persiste al navegar entre secciones.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
