"use client";

import { CaptacionesModule } from "@/components/captaciones";
import { useWorkspace } from "@/components/AppShell";

export default function CaptacionesPage() {
  const { user } = useWorkspace();
  return <CaptacionesModule agentName={user.name ?? null} />;
}
