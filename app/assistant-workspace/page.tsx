// app/assistant-workspace/page.tsx
"use client";

import AssistantWorkspace from "@/components/assistant-workspace";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AssistantWorkspacePage() {
  const router = useRouter();
  return (
    <div className="min-h-screen page-gradient">
      {/* Bar aksi */}
      <div className="w-full px-4 md:px-6 pt-3">
        <Button
          variant="default"
          size="sm"
          onClick={() => router.push("/")}
          className="gap-2 btn-gradient btn-press"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
      {/* Full-screen workspace tanpa sidebar */}
      <div className="w-full">
        <AssistantWorkspace />
      </div>
    </div>
  );
}
