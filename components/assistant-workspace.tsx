"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Send, Bot, User, FileText, Download, Copy, Check, ChevronDown, ChevronRight, Play, FileUp, Trash2
} from "lucide-react";
import { useDocuments } from "@/components/documents-context";
import FileUploadButton from "@/components/file-upload-button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
// Client-side PDF parsing (avoid server worker issues)
// We import lazily inside the function to keep SSR clean

/* ========= Types ========= */
type Msg = { id: string; role: "user" | "assistant"; text: string; timestamp?: number };
type ParsedBlock = { id: string; label: string; content: string };
type DocItem = { id: string; name: string; status?: string; file?: File };

/* ========= Chat History Storage ========= */
function getChatHistoryKey(userId: string | null): string {
  return userId ? `rag_chat_history_v1_${userId}` : "rag_chat_history_v1_guest";
}

function saveChatHistory(userId: string | null, messages: Msg[]) {
  try {
    const key = getChatHistoryKey(userId);
    // Simpan maksimal 1000 messages terakhir
    const limited = messages.slice(-1000);
    localStorage.setItem(key, JSON.stringify(limited));
    console.log("Chat history saved:", limited.length, "messages");
  } catch (e) {
    console.error("Error saving chat history:", e);
  }
}

function loadChatHistory(userId: string | null): Msg[] {
  try {
    const key = getChatHistoryKey(userId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const messages = JSON.parse(stored) as Msg[];
      console.log("Chat history loaded:", messages.length, "messages");
      return messages;
    }
  } catch (e) {
    console.error("Error loading chat history:", e);
  }
  return [];
}

function clearChatHistory(userId: string | null) {
  try {
    const key = getChatHistoryKey(userId);
    localStorage.removeItem(key);
    console.log("Chat history cleared");
  } catch (e) {
    console.error("Error clearing chat history:", e);
  }
}

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
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

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

  // Auto-parse dokumen yang baru di-upload dan belum diparsing
  useEffect(() => {
    const parseNewDocuments = async () => {
      const docsToParse: Array<{ doc: DocItem; file: File }> = [];
      
      // Kumpulkan dokumen yang perlu diparsing
      for (const doc of documents) {
        if (!doc.file || !doc.id) continue;
        
        // Skip jika sedang diparsing
        if (parsingRef.current.has(doc.id)) continue;
        
        // Skip jika sudah diparsing
        const existingBlocks = parsedById[doc.id] ?? [];
        if (existingBlocks.length > 0) continue;
        
        docsToParse.push({ doc, file: doc.file });
      }

      // Jika tidak ada dokumen yang perlu diparsing, skip
      if (docsToParse.length === 0) return;

      // Parse semua dokumen secara paralel
      const parsePromises = docsToParse.map(async ({ doc, file }) => {
        // Mark sebagai sedang diparsing
        parsingRef.current.add(doc.id);
        
        try {
          console.log(`🔄 Auto-parsing document: ${doc.name}`);
          await autoIngest(file, doc.id, setParsedById, setOpenBlocks);
          
          // Set currentId jika belum ada
          setCurrentId(prev => prev || doc.id);
          
          return { success: true, name: doc.name };
        } catch (e: any) {
          console.error(`Failed to auto-parse ${doc.name}:`, e);
          return { success: false, name: doc.name, error: e.message || "Unknown error" };
        } finally {
          // Remove dari parsing set setelah selesai
          parsingRef.current.delete(doc.id);
        }
      });

      // Tunggu semua parsing selesai
      const results = await Promise.all(parsePromises);
      
      // Tampilkan notifikasi gabungan untuk mengurangi spam
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      if (successCount > 0 && errorCount === 0) {
        // Semua berhasil
        if (successCount === 1) {
          addNotification('success', `✅ ${results[0].name} berhasil diparsing!`);
        } else {
          addNotification('success', `✅ ${successCount} dokumen berhasil diparsing!`);
        }
      } else if (successCount > 0 && errorCount > 0) {
        // Sebagian berhasil
        addNotification('success', `✅ ${successCount} dokumen berhasil diparsing, ${errorCount} gagal`);
      } else if (errorCount > 0) {
        // Semua gagal
        if (errorCount === 1) {
          addNotification('error', `❌ Gagal parsing ${results.find(r => !r.success)?.name}`);
        } else {
          addNotification('error', `❌ Gagal parsing ${errorCount} dokumen`);
        }
      }
    };

    // Delay sedikit untuk memastikan state ter-update
    if (documents.length > 0) {
      const timeoutId = setTimeout(() => {
        parseNewDocuments();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]); // Hanya watch documents, tidak watch parsedById untuk avoid infinite loop

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
  
  // Track dokumen yang sedang diparsing untuk menghindari duplicate parsing
  const parsingRef = useRef<Set<string>>(new Set());

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
  const [hydrated, setHydrated] = useState(false);

  // Get userId from Supabase
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) {
          const uid = data?.user?.id || null;
          setUserId(uid);
        }
      } catch (e) {
        console.error("Error getting user:", e);
        if (mounted) {
          setUserId(null);
        }
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        const uid = session?.user?.id || null;
        setUserId(uid);
        // Clear chat history when user changes
        if (uid !== userId) {
          setMsgs([]);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, userId]);

  // Load chat history on mount
  useEffect(() => {
    if (!userId) {
      setMsgs([]);
      setHydrated(true);
      return;
    }

    const saved = loadChatHistory(userId);
    if (saved.length > 0) {
      setMsgs(saved);
    }
    setHydrated(true);
  }, [userId]);

  // Save chat history whenever messages change
  useEffect(() => {
    if (!hydrated || !userId) return;
    saveChatHistory(userId, msgs);
  }, [msgs, hydrated, userId]);

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
    
    // Tambahkan semua file ke documents context
    addFromFiles(files);
    
    // Notifikasi bahwa file sedang di-upload
    files.forEach(file => {
      addNotification('success', `📄 ${file.name} sedang di-upload...`);
    });
    
    // Auto-parse akan dilakukan oleh useEffect yang watch documents changes
    // Ini lebih reliable karena tidak bergantung pada timing state update
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

  /** Chat — menggunakan semua dokumen yang sudah diparsing */
  const sendChat = async () => {
    const text = input.trim();
    if (!text) return;
    addQuery(text);

    const id = crypto.randomUUID?.() ?? `${Date.now()}`;
    const userMsg: Msg = { id, role: "user", text, timestamp: Date.now() };
    setMsgs((m) => [...m, userMsg]);
    setInput("");

    try {
      // Pastikan semua dokumen yang sudah di-upload sudah diparsing
      const docsToParse: Array<{ doc: DocItem; file: File }> = [];
      for (const doc of documents) {
        if (!doc.file) continue;
        const existingBlocks = parsedById[doc.id] ?? [];
        if (existingBlocks.length === 0) {
          docsToParse.push({ doc, file: doc.file });
        }
      }

      // Parse dokumen yang belum diparsing
      if (docsToParse.length > 0) {
        setIsParsing(true);
        for (const { doc, file } of docsToParse) {
          try {
            await autoIngest(file, doc.id, setParsedById, setOpenBlocks);
          } catch (e: any) {
            console.warn(`Failed to parse ${doc.name}:`, e);
          }
        }
        setIsParsing(false);
      }

      // Kumpulkan blocks dari SEMUA dokumen yang sudah diparsing
      const allBlocks: Array<{ docId: string; docName: string; block: ParsedBlock }> = [];
      for (const doc of documents) {
        const blocks = parsedById[doc.id] ?? [];
        if (blocks.length > 0) {
          blocks.forEach((block) => {
            allBlocks.push({
              docId: doc.id,
              docName: doc.name,
              block,
            });
          });
        }
      }

      // Jika tidak ada dokumen yang sudah diparsing, coba parse dokumen pertama
      if (allBlocks.length === 0 && documents.length > 0) {
        const firstDoc = documents[0];
        if (firstDoc?.file) {
          setIsParsing(true);
          try {
            const blocks = await autoIngest(firstDoc.file, firstDoc.id, setParsedById, setOpenBlocks);
            blocks.forEach((block) => {
              allBlocks.push({
                docId: firstDoc.id,
                docName: firstDoc.name,
                block,
              });
            });
          } catch (e: any) {
            console.warn(`Failed to parse first document:`, e);
          }
          setIsParsing(false);
        }
      }

      // Heuristic answer for average UTS/UAS (gunakan semua blocks)
      const flatBlocks = allBlocks.map((b) => b.block);
      const avgAnswer = tryAnswerAverageQuery(text, flatBlocks);
      if (avgAnswer) {
        setMsgs((m) => [...m, { id: `${id}-a`, role: "assistant", text: avgAnswer }]);
        return;
      }

      // Gabungkan context dari semua dokumen dengan identifier dokumen yang lebih jelas
      // Kelompokkan blocks per dokumen untuk struktur yang lebih jelas
      const contextByDoc: Record<string, Array<{ docName: string; block: ParsedBlock }>> = {};
      allBlocks.forEach(({ docName, block }) => {
        if (!contextByDoc[docName]) {
          contextByDoc[docName] = [];
        }
        contextByDoc[docName].push({ docName, block });
      });

      const context =
        allBlocks.length > 0
          ? Object.entries(contextByDoc)
              .map(([docName, blocks]) => {
                const docHeader = `=== DOKUMEN: ${docName} ===`;
                const docContent = blocks
                  .map(({ block }) => `[Bagian: ${block.label}]\n${block.content}`)
                  .join("\n\n");
                return `${docHeader}\n${docContent}`;
              })
              .join("\n\n" + "=".repeat(50) + "\n\n")
          : "(no context - tidak ada dokumen yang sudah diparsing)";

      // Gunakan jumlah dokumen yang benar-benar ada di state sebagai sumber kebenaran
      // Jangan gunakan uniqueDocNames dari retrieval karena bisa termasuk dokumen lama
      const totalDocuments = documents.length;
      const documentCount = totalDocuments; // Gunakan totalDocuments sebagai documentCount juga

      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: text, 
          context,
          metadata: {
            documentCount: documentCount,
            totalDocuments: totalDocuments,
          }
        }),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Query gagal");

      const answer = (d.answer as string) || "Saya tidak tahu.";
      const assistantMsg: Msg = { id: `${id}-a`, role: "assistant", text: answer, timestamp: Date.now() };
      setMsgs((m) => [...m, assistantMsg]);
    } catch (e: any) {
      const errorMsg: Msg = { 
        id: `${id}-a`, 
        role: "assistant", 
        text: `❌ ${e.message || "Query error"}`, 
        timestamp: Date.now() 
      };
      setMsgs((m) => [...m, errorMsg]);
    } finally {
      setIsParsing(false);
    }
  };

  /* ===== Komponen kecil ===== */
  const Separator = () => <div className="w-full h-px bg-border" />;


  function PreviewPane() {
    if (!currentDoc) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <FileText className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground">Belum ada dokumen yang dipilih</p>
          <p className="text-sm text-muted-foreground mt-2">Upload dokumen untuk melihat preview</p>
        </div>
      );
    }
    const ext = (currentDoc.name.split(".").pop() || "").toLowerCase();
    const isPDF = ext === "pdf";
    const isImg = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

    if (isPDF && previewUrl) {
      return <iframe src={previewUrl} className="w-full h-full rounded-md border border-border" />;
    }
    if (isImg && previewUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={previewUrl} alt={currentDoc.name} className="w-full h-full object-contain rounded-md border border-border" />;
    }
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div className="text-sm text-muted-foreground">
          Preview tidak tersedia untuk .{ext}. (Saran: konversi ke PDF.)
        </div>
      </div>
    );
  }

  /* ===== UI: Split Layout (Preview Kiri | Parse/Chat Kanan) ===== */
  return (
    <div className="min-h-screen page-gradient">
      {/* Header */}
      <div className="border-b border-border bg-card/70 glass soft-shadow">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gradient">Document AI Assistant</h1>
          </div>
          <div className="flex items-center gap-3">
            <FileUploadButton
              onSelectFiles={onUpload}
              label="Upload Dokumen"
              size="sm"
              variant="outline"
              className="gap-2"
              multiple
            />
            {documents.length > 0 && (
              <div className="flex items-center gap-2">
                {documents.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setCurrentId(d.id)}
                    className={`px-3 py-1.5 rounded-md border text-sm transition ${
                      currentId === d.id
                        ? "btn-gradient border-primary"
                        : "border-border hover:bg-muted/40"
                    }`}
                    title={`${d.name} — ${d.status ?? ""}`}
                  >
                    <span className="truncate max-w-[150px] block">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="h-[calc(100vh-4rem)] flex">
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

        {/* ========== PREVIEW DOKUMEN (Kiri) ========== */}
        <div className="w-1/2 border-r border-border bg-card/30 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Preview Dokumen</h2>
              {currentDoc && <Badge variant="outline" className="ml-2">{currentDoc.name}</Badge>}
            </div>
            {previewUrl && currentDoc && (
              <Button
                variant="ghost"
                size="sm"
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
          <div className="flex-1 overflow-auto rounded-md border border-border bg-background">
            <PreviewPane />
          </div>
        </div>

        {/* ========== PARSE & CHAT (Kanan) ========== */}
        <div className="w-1/2 p-4 flex flex-col">
          <Tabs defaultValue="chat" className="flex flex-col h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="parse" className="gap-2">
                <FileText className="h-4 w-4" />
                Parse
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <Bot className="h-4 w-4" />
                Chat
              </TabsTrigger>
            </TabsList>

            {/* Tab Parse */}
            <TabsContent value="parse" className="flex-1 overflow-auto">
              <Card className="bg-card/70 glass soft-shadow hover-card h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Hasil Parse</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Auto-parse saat upload
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  {parsedBlocks.length ? (
                    <div className="space-y-2 pr-1">
                      {parsedBlocks.map((b) => {
                        const isOpen = blockOpen(b.id);
                        return (
                          <div key={b.id} className="rounded-md border border-border/60">
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/40 transition"
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
                                <pre className="whitespace-pre-wrap text-xs bg-muted/30 p-2 rounded">{b.content}</pre>
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
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                      <p className="text-sm text-muted-foreground">Belum ada hasil parse</p>
                      <p className="text-xs text-muted-foreground mt-2">Upload dokumen untuk auto-parse</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Chat */}
            <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col">
              <Card className="bg-card/70 glass soft-shadow hover-card h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      <CardTitle className="text-base">Chat dengan Dokumen</CardTitle>
                      {currentDoc && <Badge variant="outline" className="ml-2">{currentDoc.name}</Badge>}
                    </div>
                    {msgs.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Apakah Anda yakin ingin menghapus semua history chat?")) {
                            setMsgs([]);
                            clearChatHistory(userId);
                          }
                        }}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Hapus History
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 flex-1 overflow-auto space-y-4">
                  {msgs.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Halo! Bagaimana saya dapat membantu Anda hari ini?</p>
                      <p className="mt-2 text-xs opacity-75">• Upload dokumen untuk chat dengan konteks</p>
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
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
