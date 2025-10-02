// components/main-content.tsx
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Clock, Download, Trash2, TrendingUp, Filter } from "lucide-react";
import { useDocuments } from "@/components/documents-context";
import FileUploadButton from "@/components/file-upload-button"; // ⬅️ NEW
import { cn } from "@/lib/utils";

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

export function MainContent() {
  const {
    documents,
    removeDocument,
    recentQueries,
    removeQuery,
    clearQueries,
    addFromFiles,            // ⬅️ NEW
  } = useDocuments();

  const summaryStats = useMemo(() => {
    const total = documents.length.toString();
    const generated = documents.filter((d) => d.status === "Processed").length.toString();
    return [
      { label: "Total Documents", value: total, icon: FileText },
      { label: "Documents Generated", value: generated, icon: TrendingUp },
      { label: "Total Queries", value: recentQueries.length.toString(), icon: MessageSquare },
    ];
  }, [documents, recentQueries]);

  const downloadFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryStats.map((stat, index) => (
          <Card key={index} className="bg-card/70 glass soft-shadow hover-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Queries */}
      <Card className="bg-card/70 glass soft-shadow hover-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Queries
          </CardTitle>

          <Button
            variant="ghost"
            size="sm"
            className="ring-ambient text-gradient hover:text-foreground"
            disabled={recentQueries.length === 0}
            onClick={() => {
              if (recentQueries.length === 0) return;
              if (window.confirm("Hapus semua recent queries?")) clearQueries();
            }}
          >
            Clear All
          </Button>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {recentQueries.length > 0 ? (
              recentQueries.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{q.text}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(q.at)}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ring-ambient"
                      onClick={() => removeQuery(q.id)}
                      aria-label="Delete query"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-lg bg-muted/20 text-sm text-muted-foreground">
                Belum ada query. Coba ketik di AI Assistant lalu klik <b>Send</b>.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="bg-card/70 glass soft-shadow hover-card">
        {/* ⬇️ HEADER BARU: tombol di sisi kanan */}
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="justify-start gap-2 btn-gradient border-0 ring-ambient"
              onClick={() => {
                // TODO: tampilkan panel filter / modal di sini
                // sementara hanya placeholder
              }}
              aria-label="Filter Documents"
              title="Filter Documents"
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>

            <FileUploadButton
              onSelectFiles={addFromFiles}
              label="Upload Document"
              variant="outline"
              size="sm"
              className="gap-2 ring-ambient btn-gradient"
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto table-row-hover">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Size</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Upload Date</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length > 0 ? (
                  documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/50">
                      <td className="py-3 px-2 text-sm text-foreground">{doc.name}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">{doc.size}</td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">{doc.uploadDate}</td>
                      <td className="py-3 px-2">
                        <Badge 
                          variant={doc.status === "Processed" ? "default" : "secondary"} 
                          className={cn("text-xs", doc.status === "Processed" && "btn-gradient")}
                        >
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ring-ambient"
                            onClick={() => downloadFile(doc.file)}
                            disabled={!doc.file}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ring-ambient"
                            onClick={() => removeDocument(doc.id)}
                            aria-label={`Delete ${doc.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Belum ada dokumen. Klik <b>Upload Document</b> di atas tabel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
