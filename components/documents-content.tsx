// components/documents-content.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Trash2, Filter, Search, Eye, X, Loader2 } from "lucide-react";
import { useDocuments } from "@/components/documents-context";
import FileUploadButton from "@/components/file-upload-button";
import { cn } from "@/lib/utils";
import { listChunksForDocument, getMetaForDocument, buildIndexForDocument } from "@/lib/ragLocal";
import { createClient } from "@/lib/supabase/client";

type FilterType = "all" | "pdf" | "docx" | "txt" | "xlsx";

export function DocumentsContent() {
  const {
    documents,
    removeDocument,
    addFromFiles,
  } = useDocuments();

  // Auto-parse documents when uploaded (check for documents that need parsing)
  useEffect(() => {
    const parseNewDocuments = async () => {
      // Check all documents that have file but might not be parsed yet
      const docsToParse = documents.filter(
        (doc) => doc.file && doc.status === "Processed"
      );
      
      for (const doc of docsToParse) {
        if (!doc.file) continue;
        
        try {
          // Check if already parsed
          const existingChunks = await listChunksForDocument(doc.id);
          if (existingChunks.length > 0) {
            // Already parsed, skip
            continue;
          }
          
          // Parse in background (silent, no UI blocking)
          console.log(`🔄 Auto-parsing document: ${doc.name}`);
          await buildIndexForDocument(doc.id, doc.file);
          console.log(`✅ Auto-parsed document: ${doc.name}`);
        } catch (error) {
          console.error(`❌ Failed to auto-parse ${doc.name}:`, error);
          // Don't show error to user, just log it
        }
      }
    };

    // Only run if we have documents and they're hydrated
    if (documents.length > 0) {
      // Delay a bit to avoid parsing immediately on every render
      const timeoutId = setTimeout(() => {
        parseNewDocuments();
      }, 2000); // Wait 2 seconds after upload
      
      return () => clearTimeout(timeoutId);
    }
  }, [documents]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Get user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((doc) => 
        doc.type.toLowerCase() === filterType.toLowerCase()
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [documents, filterType, searchQuery]);

  const downloadFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadPreview = async (docId: string) => {
    setPreviewLoading(true);
    setPreviewText("");
    try {
      const chunks = await listChunksForDocument(docId);
      if (chunks.length > 0) {
        const text = chunks
          .sort((a, b) => a.start - b.start)
          .map((ch) => ch.text)
          .join("\n\n");
        setPreviewText(text);
      } else {
        setPreviewText("Teks belum diekstraksi. Klik tombol 'Parse Sekarang' untuk memproses dokumen.");
      }
    } catch (error) {
      console.error("Error loading preview:", error);
      setPreviewText("Teks belum diekstraksi. Klik tombol 'Parse Sekarang' untuk memproses dokumen.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const parseDocument = async (docId: string, file: File) => {
    if (!file) {
      setPreviewText("File tidak tersedia untuk diparsing.");
      return;
    }

    setParsingDocId(docId);
    setPreviewText("Sedang memproses dokumen...");
    
    try {
      await buildIndexForDocument(docId, file, (stage, info) => {
        if (stage === "parse") {
          setPreviewText("Mem-parse dokumen...");
        } else if (stage === "chunk") {
          setPreviewText("Membagi teks menjadi chunks...");
        } else if (stage === "embed") {
          const { done, total } = info || {};
          if (done && total) {
            setPreviewText(`Membuat embeddings... ${done}/${total}`);
          }
        } else if (stage === "persist") {
          setPreviewText("Menyimpan ke database...");
        }
      });

      // Reload preview setelah parsing selesai
      await loadPreview(docId);
    } catch (error: any) {
      console.error("Error parsing document:", error);
      setPreviewText(`Gagal memproses dokumen: ${error.message || "Unknown error"}`);
    } finally {
      setParsingDocId(null);
    }
  };

  const openPreview = async (docId: string) => {
    setSelectedDoc(docId);
    setShowPreview(true);
    await loadPreview(docId);
  };

  const closePreview = () => {
    setShowPreview(false);
    setSelectedDoc(null);
    setPreviewText("");
  };

  const selectedDocData = selectedDoc ? documents.find((d) => d.id === selectedDoc) : null;

  return (
    <main className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Search & Filter Bar */}
      <Card className="bg-card/70 glass soft-shadow">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari dokumen berdasarkan nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Type */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Semua Tipe</option>
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="txt">TXT</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="bg-card/70 glass soft-shadow hover-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Kelola Dokumen
            {filteredDocuments.length !== documents.length && (
              <Badge variant="secondary" className="ml-2">
                {filteredDocuments.length} dari {documents.length}
              </Badge>
            )}
          </CardTitle>

          <FileUploadButton
            onSelectFiles={addFromFiles}
            label="Upload Document"
            variant="outline"
            size="sm"
            className="gap-2 ring-ambient btn-gradient btn-press"
          />
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
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30">
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
                            className="ring-ambient icon-press"
                            onClick={() => openPreview(doc.id)}
                            title="Detail & Pratinjau"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ring-ambient icon-press"
                            onClick={() => downloadFile(doc.file)}
                            disabled={!doc.file}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ring-ambient icon-press text-destructive hover:text-destructive"
                            onClick={() => removeDocument(doc.id)}
                            aria-label={`Delete ${doc.name}`}
                            title="Hapus"
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
                      {searchQuery || filterType !== "all" 
                        ? "Tidak ada dokumen yang sesuai dengan filter."
                        : "Belum ada dokumen. Klik Upload Document di atas tabel."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {showPreview && selectedDocData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-semibold text-gradient">Detail & Pratinjau</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedDocData.name}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closePreview}
                className="icon-press"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ID Dokumen</label>
                  <p className="text-sm text-foreground mt-1 font-mono break-all">{selectedDocData.id}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">User ID</label>
                  <p className="text-sm text-foreground mt-1 font-mono break-all">{userId || "Tidak tersedia"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipe</label>
                  <p className="text-sm text-foreground mt-1">{selectedDocData.type}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ukuran</label>
                  <p className="text-sm text-foreground mt-1">{selectedDocData.size}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tanggal Upload</label>
                  <p className="text-sm text-foreground mt-1">{selectedDocData.uploadDate}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Badge 
                    variant={selectedDocData.status === "Processed" ? "default" : "secondary"}
                    className={cn("text-xs mt-1", selectedDocData.status === "Processed" && "btn-gradient")}
                  >
                    {selectedDocData.status}
                  </Badge>
                </div>
              </div>

              {/* Preview Text */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Pratinjau Teks (Hasil Ekstraksi AI)</label>
                  {selectedDocData.file && previewText.includes("belum diekstraksi") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => parseDocument(selectedDocData.id, selectedDocData.file!)}
                      disabled={parsingDocId === selectedDocData.id}
                      className="btn-press"
                    >
                      {parsingDocId === selectedDocData.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        "Parse Sekarang"
                      )}
                    </Button>
                  )}
                </div>
                <div className="mt-2 p-4 bg-muted/30 rounded-lg border border-border max-h-96 overflow-auto">
                  {previewLoading || parsingDocId === selectedDocData.id ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {parsingDocId === selectedDocData.id ? "Memproses dokumen..." : "Memuat teks..."}
                      </span>
                    </div>
                  ) : (
                    <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                      {previewText || "Teks belum diekstraksi. Klik tombol 'Parse Sekarang' untuk memproses dokumen."}
                    </pre>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
              <Button
                variant="outline"
                onClick={closePreview}
                className="btn-press"
              >
                Tutup
              </Button>
              <Button
                variant="default"
                onClick={() => downloadFile(selectedDocData.file)}
                disabled={!selectedDocData.file}
                className="btn-gradient btn-press"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

