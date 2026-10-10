"use client";

import { useRouter } from "next/navigation";
import { EnhanceWorkspace } from "@/components/EnhanceWorkspace";
import { useWorkspace } from "@/components/AppShell";

export default function FotosPage() {
  const router = useRouter();
  const { enhanceQueue, availableCleanCount, openSendToEnhance } = useWorkspace();
  return (
    <EnhanceWorkspace
      queueController={enhanceQueue}
      availableCleanCount={availableCleanCount}
      onOpenImportModal={openSendToEnhance}
      onBack={() => router.push("/limpieza")}
    />
  );
}
