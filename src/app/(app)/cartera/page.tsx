"use client";

import { CrmAssistantModule } from "@/components/crm-assistant";
import { useWorkspace } from "@/components/AppShell";

export default function CarteraPage() {
  const { user } = useWorkspace();
  return <CrmAssistantModule agentName={user.name ?? null} preferredName={user.preferredName || null} />;
}
