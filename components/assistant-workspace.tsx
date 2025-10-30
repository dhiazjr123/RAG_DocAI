"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, Bot, User, FileText, Download, Copy, Check, ChevronDown, ChevronRight, Play
} from "lucide-react";
import { useDocuments } from "@/components/documents-context";
import FileUploadButton from "@/components/file-upload-button";
import { cn } from "@/lib/utils";
// Client-side PDF parsing (avoid server worker issues)
// We import lazily inside the function to keep SSR clean

/* ========= Types ========= */
type Msg = { id: string; role: "user" | "assistant"; text: string };
type ParsedBlock = { id: string; label: string; content: string };
type DocItem = { id: string; name: string; status?: string; file?: File };

/* ========= Utils ========= */
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ===== Helpers for client-side PDF parsing =====
async function parsePdfInBrowser(file: File): Promise<string> {
  const { getDocument } = (await import("pdfjs-dist")) as any;
  const buf = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: buf, disableWorker: true }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items || []) as any[];
    // Group by Y (line) with tolerance
    const linesMap = new Map<number, { y: number; items: any[] }>();
    const tol = 2; // px
    for (const it of items) {
      const y = (it?.transform?.[5] as number) ?? 0;
      let key = y;
      // find existing key within tolerance
      for (const k of Array.from(linesMap.keys())) {
        if (Math.abs(k - y) <= tol) { key = k; break; }
      }
      if (!linesMap.has(key)) linesMap.set(key, { y: key, items: [] });
      linesMap.get(key)!.items.push(it);
    }
    // Sort lines top->bottom (y descending in PDF), then items by x
    const lines = Array.from(linesMap.values()).sort((a,b) => b.y - a.y);
    const pageLines = lines.map(line => {
      const sorted = line.items.sort((a,b) => ((a.transform?.[4]??0) - (b.transform?.[4]??0)));
      return sorted.map(it => it?.str ?? "").join(" ");
    });
    const pageText = pageLines.map(s => s.replace(/\s+/g, " ").trim()).join("\n").trim();
    if (pageText) fullText += pageText + "\n";
  }
  return fullText.trim();
}

function splitToBlocksClient(text: string, blockSize = 1200): ParsedBlock[] {
  const out: ParsedBlock[] = [];
  const clean = (text || "").replace(/\r/g, "").trim();
  if (!clean) return [{ id: "1", label: "Text 1", content: "(empty file)" }];
  let i = 0,
    idx = 1;
  while (i < clean.length) {
    out.push({ id: String(idx), label: `Text ${idx}`, content: clean.slice(i, i + blockSize).trim() });
    i += blockSize;
    idx++;
  }
  return out;
}

async function mockExtract(file: File): Promise<Record<string, string>> {
  await wait(400);
  return { title: file.name, authors: "Penulis A; Penulis B", year: "2018", keywords: "contoh, demo" };
}

/** Ingest file -> simpan parsedBlocks ke state, buka semua blok */
async function autoIngest(
  file: File,
  docId: string,
  setParsedById: React.Dispatch<React.SetStateAction<Record<string, ParsedBlock[]>>>,
  setOpenBlocks: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>
) {
  let blocks: ParsedBlock[] = [];
  const isPdf = file.type?.includes("pdf") || file.name?.toLowerCase().endsWith(".pdf");
  
  if (isPdf) {
    // Parse PDF using pdfplumber via API (better table extraction)
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pdf/parse", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.text) {
        blocks = splitToBlocksClient(d.text);
      } else {
        // Fallback to client-side parsing
        const text = await parsePdfInBrowser(file);
        blocks = splitToBlocksClient(text);
      }
    } catch (error) {
      // Fallback to client-side parsing if pdfplumber fails
      console.warn("Pdfplumber failed, using PDF.js fallback:", error);
      const text = await parsePdfInBrowser(file);
      blocks = splitToBlocksClient(text);
    }
  } else {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/rag/ingest", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d?.error || "Ingest gagal");
    blocks = d.parsedBlocks || [];
  }
  setParsedById((prev) => ({ ...prev, [docId]: blocks }));
  setOpenBlocks((prev) => ({
    ...prev,
    [docId]: blocks.reduce((acc, b) => ((acc[b.id] = true), acc), {} as Record<string, boolean>),
  }));
  return blocks;
}

/** Cari Doc hasil addFromFiles yang match dengan file (nama & type) */
async function findDocByFile(
  getDocs: () => DocItem[],
  file: File,
  retries = 20,
  delayMs = 75
): Promise<DocItem | null> {
  for (let i = 0; i < retries; i++) {
    const docs = getDocs();
    const found = docs.find((d) => d.file && d.file.name === file.name && d.file.type === file.type);
    if (found) return found;
    await wait(delayMs);
  }
  return null;
}

/* ========= Komponen Utama ========= */
export default function AssistantWorkspace() {
  const router = useRouter();
  const { documents, addFromFiles, addQuery } = useDocuments();

  // Dokumen aktif
  const [currentId, setCurrentId] = useState<string | null>(null);
  const currentDoc = useMemo(
    () => documents.find((d) => d.id === currentId),
    [documents, currentId]
  );

  // Preview URL
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (currentDoc?.file) {
      const url = URL.createObjectURL(currentDoc.file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [currentDoc?.file]);

  // Pilih doc pertama otomatis
  useEffect(() => {
    if (!currentId && documents.length > 0) {
      setCurrentId(documents[0].id);
    }
  }, [documents, currentId]);

  // Hasil Parse & Extract per dokumen
  const [parsedById, setParsedById] = useState<Record<string, ParsedBlock[]>>({});
  const [extractedById, setExtractedById] = useState<Record<string, Record<string, string>>>({});
  const parsedBlocks = currentId ? parsedById[currentId] ?? [] : [];
  const extracted = currentId ? extractedById[currentId] ?? {} : {};

  // Expand state per block
  const [openBlocks, setOpenBlocks] = useState<Record<string, Record<string, boolean>>>({});
  const blockOpen = (bid: string) => !!openBlocks[currentId ?? ""]?.[bid];

  // Loading flags
  const [isParsing, setIsParsing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error';
    message: string;
    timestamp: number;
  }>>([]);

  // Chat
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);

  /* ===== Handlers ===== */

  // Heuristic: compute average scores from parsed text
  function tryAnswerAverageQuery(query: string, blocks: ParsedBlock[]): string | null {
    const q = query.toLowerCase();
    const isAvg = q.includes("rata") || q.includes("average") || q.includes("mean");
    const isUts = q.includes("uts");
    const isUas = q.includes("uas");
    if (!isAvg || (!isUts && !isUas)) return null;

    const texts = blocks.map(b => b.content).join("\n");
    // Focus by exam keyword
    const examFiltered = isUts || isUas
      ? texts
          .split(/\n+/)
          .filter(line => (isUts && /\buts\b/i.test(line)) || (isUas && /\buas\b/i.test(line)))
          .join("\n")
      : texts;

    // Extract numbers that look like scores 0-100 (supports comma/point decimals)
    const numMatches = examFiltered.match(/\b\d{1,3}(?:[.,]\d+)?\b/g) || [];
    const nums = numMatches
      .map(s => Number(String(s).replace(",", ".")))
      .filter(v => isFinite(v) && v >= 0 && v <= 100);

    if (nums.length === 0) return "Maaf, tidak ditemukan angka nilai yang relevan untuk dihitung.";
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / nums.length;
    const examLabel = isUts ? "UTS" : "UAS";
    return `Perkiraan rata-rata ${examLabel}: ${avg.toFixed(2)} (n=${nums.length}).`;
  }

  /** Add notification */
  const addNotification = (type: 'success' | 'error', message: string) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}`;
    setNotifications(prev => [...prev, { id, type, message, timestamp: Date.now() }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  /** Upload → auto-ingest (seperti NotebookLM: tambah sumber langsung diproses) */
  const onUpload = async (files: File[]) => {
    if (!files.length) return;
    addFromFiles(files);

    for (const file of files) {
      try {
        const doc = await findDocByFile(() => documents as DocItem[], file);
        if (!doc || !doc.id) continue;
        setCurrentId(doc.id);
        
        // Auto-parse in background
        addNotification('success', `Memulai parsing ${file.name}...`);
        await autoIngest(file, doc.id, setParsedById, setOpenBlocks);
        addNotification('success', `✅ ${file.name} berhasil diparsing!`);
      } catch (e: any) {
        addNotification('error', `❌ Gagal parsing ${file.name}: ${e.message || "Unknown error"}`);
      }
    }
  };

  /** Parse manual dari kartu Studio */
  const runParse = async () => {
    if (!currentDoc?.file || !currentId) return alert("Pilih dokumen yang punya file.");
    setIsParsing(true);
    try {
      await autoIngest(currentDoc.file, currentId, setParsedById, setOpenBlocks);
    } catch (e: any) {
      alert(e.message || "Ingest error");
    } finally {
      setIsParsing(false);
    }
  };

  /** Extract mock (metadata) */
  const runExtract = async () => {
    if (!currentDoc?.file || !currentId) return alert("Pilih dokumen yang punya file.");
    setIsExtracting(true);
    try {
      const data = await mockExtract(currentDoc.file);
      setExtractedById((prev) => ({ ...prev, [currentId]: data }));
    } finally {
      setIsExtracting(false);
    }
  };

  /** Chat — kalau belum ada parse untuk doc aktif, parse dulu diam-diam */
  const sendChat = async () => {
    const text = input.trim();
    if (!text) return;
    addQuery(text);

    const id = crypto.randomUUID?.() ?? `${Date.now()}`;
    setMsgs((m) => [...m, { id, role: "user", text }]);
    setInput("");

    try {
      const docId = currentId || documents[0]?.id || null;
      const docFile = docId ? (documents.find((d) => d.id === docId)?.file as File | undefined) : undefined;

      let blocks = docId ? parsedById[docId] ?? [] : [];
      if ((!blocks || blocks.length === 0) && docId && docFile) {
        setIsParsing(true);
        blocks = await autoIngest(docFile, docId, setParsedById, setOpenBlocks);
        setIsParsing(false);
      }

      // Heuristic answer for average UTS/UAS
      const avgAnswer = tryAnswerAverageQuery(text, blocks);
      if (avgAnswer) {
        setMsgs((m) => [...m, { id: `${id}-a`, role: "assistant", text: avgAnswer }]);
        return;
      }

      const context =
        (blocks ?? [])
          .map((b) => `[${b.label}] ${b.content}`)
          .join("\n\n") || "(no context)";

      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, context }),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Query gagal");

      const answer = (d.answer as string) || "Saya tidak tahu.";
      setMsgs((m) => [...m, { id: `${id}-a`, role: "assistant", text: answer }]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { id: `${id}-a`, role: "assistant", text: `❌ ${e.message || "Query error"}` },
      ]);
    } finally {
      setIsParsing(false);
    }
  };

  /* ===== Komponen kecil ===== */
  const Separator = () => <div className="w-full h-px bg-border" />;


  function PreviewPane() {
    if (!currentDoc) return null;
    const ext = (currentDoc.name.split(".").pop() || "").toLowerCase();
    const isPDF = ext === "pdf";
    const isImg = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

    if (isPDF && previewUrl) {
      return <iframe src={previewUrl} className="w-full h-[260px] rounded-md border border-border" />;
    }
    if (isImg && previewUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={previewUrl} alt={currentDoc.name} className="w-full max-h-[260px] object-contain rounded-md border border-border" />;
    }
    return (
      <div className="text-xs text-muted-foreground">
        Preview tidak tersedia untuk .{ext}. (Saran: konversi ke PDF.)
      </div>
    );
  }

  /* ===== UI: NotebookLM-style (Sumber | Chat | Studio) ===== */
  return (
    <div className="min-h-screen page-gradient">
      {/* Header */}
      <div className="border-b border-border bg-card/70 glass soft-shadow">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gradient">Document AI Assistant</h1>
          </div>
        </div>
      </div>

      <main className="p-4 md:p-6 overflow-auto">
        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="fixed top-20 right-4 z-50 space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm max-w-sm transform transition-all duration-300 ease-in-out animate-in slide-in-from-right-5 ${
                  notification.type === 'success'
                    ? 'bg-emerald-500/90 text-white border-emerald-400'
                    : 'bg-red-500/90 text-white border-red-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{notification.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ========== SUMBER (kiri) ========== */}
        <Card className="lg:col-span-3 bg-card/70 glass soft-shadow hover-card flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sumber</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileUploadButton
                onSelectFiles={onUpload}
                label="Tambah"
                size="sm"
                variant="outline"
                className="gap-2"
                multiple
              />
            </div>

            <Separator />

            <div className="space-y-2">
              {documents.length ? (
                documents.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setCurrentId(d.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm transition
                    ${currentId === d.id
                      ? "btn-gradient border-primary"
                      : "border-border hover:bg-muted/40"}`}
                    title={`${d.name} — ${d.status ?? ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{d.name}</span>
                      {d.status && (
                        <Badge 
                          variant={d.status === "Processed" ? "default" : "outline"} 
                          className={cn("ml-2", d.status === "Processed" && "btn-gradient")}
                        >
                          {d.status}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">Belum ada sumber. Klik <b>Tambah</b> untuk mengunggah file.</div>
              )}
            </div>

            <Separator />
            {currentDoc && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Pratinjau</div>
                <PreviewPane />
                {previewUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = previewUrl!;
                      a.download = currentDoc.name;
                      a.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========== CHAT (tengah) ========== */}
        <Card className="lg:col-span-6 bg-card/70 glass soft-shadow hover-card flex flex-col min-h-[70vh]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base">Chat</CardTitle>
              {currentDoc && <Badge variant="outline" className="ml-2">{currentDoc.name}</Badge>}
            </div>
          </CardHeader>

          <CardContent className="pt-4 flex-1 overflow-auto space-y-4">
            {msgs.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Halo! Bagaimana saya dapat membantu Anda hari ini?</p>
                <p className="mt-2 text-xs opacity-75">• Upload dokumen di panel "Sumber" untuk chat dengan konteks</p>
                <p className="text-xs opacity-75">• Atau langsung tanyakan apapun di sini</p>
              </div>
            ) : (
              msgs.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="mt-1 rounded-full p-2 bg-muted/50">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/40 text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.role === "user" && (
                    <div className="mt-1 rounded-full p-2 bg-muted/50">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>

          <div className="p-4 border-t border-border flex items-end gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis prompt kamu…"
              className="min-h-[64px] resize-none flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendChat(); }}
            />
            <Button className="gap-2 btn-gradient" onClick={sendChat} disabled={isParsing}>
              <Send className="h-4 w-4" />
              Kirim
            </Button>
          </div>
        </Card>

        {/* ========== STUDIO (kanan) ========== */}
        <div className="lg:col-span-3 space-y-4">
          {/* Kartu Parse */}
          <Card className="bg-card/70 glass soft-shadow hover-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Parse</CardTitle>
                <div className="text-xs text-muted-foreground">
                  Auto-parse saat upload
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {parsedBlocks.length ? (
                <div className="max-h-[260px] overflow-auto space-y-2 pr-1">
                  {parsedBlocks.map((b) => {
                    const isOpen = blockOpen(b.id);
                    return (
                      <div key={b.id} className="rounded-md border border-border/60">
                        <button
                          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
                          onClick={() =>
                            setOpenBlocks((prev) => ({
                              ...prev,
                              [currentId!]: { ...(prev[currentId!] ?? {}), [b.id]: !isOpen },
                            }))
                          }
                        >
                          <span className="truncate">{b.label}</span>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3">
                            <pre className="whitespace-pre-wrap text-xs">{b.content}</pre>
                            <div className="pt-2">
                              <Button
                                variant="ghost" size="sm"
                                onClick={async () => await navigator.clipboard.writeText(b.content)}
                              >
                                <Copy className="h-4 w-4 mr-1" /> Copy
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Belum ada hasil. Unggah file untuk auto-parse.</div>
              )}
            </CardContent>
          </Card>

          {/* Kartu Extract */}
          <Card className="bg-card/70 glass soft-shadow hover-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Extract</CardTitle>
                <Button size="sm" variant="secondary" onClick={runExtract} disabled={!currentDoc?.file || isExtracting} className="gap-2">
                  <Play className="h-4 w-4" />
                  {isExtracting ? "Extracting..." : "Jalankan"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(extracted).length ? (
                <div className="space-y-3 max-h-[260px] overflow-auto pr-1">
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(extracted).map(([k, v]) => (
                        <tr key={k} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 font-medium whitespace-nowrap">{k}</td>
                          <td className="py-1.5 text-muted-foreground">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <Button
                    variant="ghost" size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(JSON.stringify(extracted, null, 2));
                      setCopied(true); setTimeout(() => setCopied(false), 1200);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? "Copied" : "Copy JSON"}
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Belum ada hasil. Klik <b>Jalankan</b> untuk mengekstrak metadata sederhana.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
    </div>
  );
}
