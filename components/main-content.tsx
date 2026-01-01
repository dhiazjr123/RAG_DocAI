// components/main-content.tsx
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Clock, Trash2, TrendingUp } from "lucide-react";
import { useDocuments } from "@/components/documents-context";

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
    recentQueries,
    removeQuery,
    clearQueries,
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
            className="ring-ambient text-gradient hover:text-foreground btn-press"
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

    </main>
  );
}
