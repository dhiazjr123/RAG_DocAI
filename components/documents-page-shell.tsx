// components/documents-page-shell.tsx
"use client";

import { Header } from "@/components/header";
import Sidebar from "@/components/sidebar";
import { DocumentsContent } from "@/components/documents-content";

export default function DocumentsPageShell() {
  return (
    <div className="min-h-screen page-gradient">
      <Header />
      <div className="flex">
        <Sidebar />
        <DocumentsContent />
      </div>
    </div>
  );
}

