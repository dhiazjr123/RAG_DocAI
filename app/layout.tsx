// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import { DocumentsProvider } from "@/components/documents-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Document AI - Enterprise Document Analysis",
  description: "AI-powered document analysis with RAG technology for enterprise document management",
  generator: "v0.app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <DocumentsProvider>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
        </DocumentsProvider>
      </body>
    </html>
  );
}
