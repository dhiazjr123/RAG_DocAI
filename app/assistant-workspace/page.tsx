// app/assistant-workspace/page.tsx
"use client";

import { Header } from "@/components/header";
import { DocumentsProvider } from "@/components/documents-context";
import AssistantWorkspace from "@/components/assistant-workspace";

export default function AssistantWorkspacePage() {
  return (
    <DocumentsProvider>
      <div className="min-h-screen page-gradient">
        <Header />
        {/* Full-screen workspace tanpa sidebar */}
        <div className="w-full">
          <AssistantWorkspace />
        </div>
      </div>
    </DocumentsProvider>
  );
}
