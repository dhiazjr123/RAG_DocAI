// components/documents-context.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { deleteIndexForDocument } from "@/lib/ragLocal";

/* ================== Types ================== */

export type DocRow = {
  id: string;
  name: string;
  type: string;                  // ekstensi (PDF, DOCX, ...)
  size: string;                  // "2.4 MB"
  uploadDate: string;            // "YYYY-MM-DD"
  status: "Processing" | "Processed";
  file?: File;                   // disimpan di IndexedDB (Blob)
};

export type RecentQuery = {
  id: string;
  text: string;
  at: number;                    // timestamp (ms)
};

type Ctx = {
  documents: DocRow[];
  addFromFiles: (files: File[]) => void;
  removeDocument: (id: string) => void;

  recentQueries: RecentQuery[];
  addQuery: (text: string) => void;
  removeQuery: (id: string) => void;
  clearQueries: () => void;
};

/* ================== Keys & helpers ================== */

const LS_DOCS_KEY = "rag_docs_v1";
const LS_QUERIES_KEY = "rag_recent_queries_v1";

type DocMeta = Omit<DocRow, "file">;

/** format ukuran file */
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** tebak mime dari ekstensi utk buat File dari Blob saat hydrate */
function mimeFromExt(extUpper: string) {
  const ext = extUpper.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "txt": return "text/plain";
    case "doc": return "application/msword";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls": return "application/vnd.ms-excel";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt": return "application/vnd.ms-powerpoint";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default: return "application/octet-stream";
  }
}

/* ================== IndexedDB (simpel) ================== */

const IDB_NAME = "rag-docs-db";
const IDB_VERSION = 1;
const STORE_FILES = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES); // key = id (string)
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutFile(id: string, blob: Blob) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readwrite");
    tx.objectStore(STORE_FILES).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGetFile(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readonly");
    const req = tx.objectStore(STORE_FILES).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function idbDeleteFile(id: string) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readwrite");
    tx.objectStore(STORE_FILES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/* ================== Context ================== */

const DocumentsCtx = createContext<Ctx | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [hydrated, setHydrated] = useState(false); // supaya tidak nulis ke LS saat tahap load

  /* ---------- HYDRATE dari localStorage + IndexedDB ---------- */
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        console.log("Starting hydration...");
        
        // load docs (metadata) dari LS
        const metaJson = localStorage.getItem(LS_DOCS_KEY);
        const metas: DocMeta[] = metaJson ? JSON.parse(metaJson) : [];
        console.log("Loaded metadata:", metas.length, "documents");

        // gabungkan dengan file Blob dari IndexedDB
        const restored: DocRow[] = await Promise.all(
          metas.map(async (m) => {
            let file: File | undefined;
            try {
              const blob = await idbGetFile(m.id);
              if (blob) {
                file = new File([blob], m.name, { type: mimeFromExt(m.type) });
              }
            } catch (error) {
              console.warn("Failed to load file from IndexedDB:", m.id, error);
              // jika gagal ambil file, biarkan undefined
            }
            return { ...m, file };
          }),
        );
        
        if (mounted) {
          setDocuments(restored);
          console.log("Documents restored:", restored.length);
        }

        // load recent queries
        const rqJson = localStorage.getItem(LS_QUERIES_KEY);
        const rq: RecentQuery[] = rqJson ? JSON.parse(rqJson) : [];
        
        if (mounted) {
          setRecentQueries(rq);
          console.log("Queries restored:", rq.length);
        }
      } catch (e) {
        console.error("Gagal hydrate:", e);
      } finally {
        if (mounted) {
          console.log("Hydration completed");
          setHydrated(true);
        }
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- Persist otomatis saat state berubah ---------- */
  useEffect(() => {
    if (!hydrated) return;
    const metas: DocMeta[] = documents.map(({ file, ...meta }) => meta);
    localStorage.setItem(LS_DOCS_KEY, JSON.stringify(metas));
  }, [documents, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_QUERIES_KEY, JSON.stringify(recentQueries));
  }, [recentQueries, hydrated]);

  /* ---------- Actions ---------- */

  const addFromFiles = (files: File[]) => {
    const today = new Date().toISOString().slice(0, 10);

    const rows: DocRow[] = files.map((f) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      return {
        id,
        name: f.name,
        type: (f.name.split(".").pop() || "").toUpperCase(),
        size: formatBytes(f.size),
        uploadDate: today,
        status: "Processing",
        file: f,
      };
    });

    // update UI dulu
    setDocuments((prev) => [...rows, ...prev]);

    // simpan file ke IndexedDB (async)
    rows.forEach((r) => {
      if (r.file) {
        idbPutFile(r.id, r.file).catch((e) => console.error("Gagal simpan file ke IDB:", e));
      }
    });

    // simulasi selesai proses
    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (rows.some((r) => r.id === d.id) ? { ...d, status: "Processed" } : d)),
      );
    }, 1200);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    idbDeleteFile(id).catch((e) => console.error("Gagal hapus file di IDB:", e));
    deleteIndexForDocument(id).catch((e) => console.error("Gagal hapus index RAG:", e));
  };

  const addQuery = (text: string) => {
    const q: RecentQuery = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      text,
      at: Date.now(),
    };
    setRecentQueries((prev) => [q, ...prev].slice(0, 50)); // simpan maksimal 50
  };

  const removeQuery = (id: string) => {
    setRecentQueries((prev) => prev.filter((q) => q.id !== id));
  };

  const clearQueries = () => {
    setRecentQueries([]);
  };

  const value = useMemo(
    () => ({
      documents,
      addFromFiles,
      removeDocument,
      recentQueries,
      addQuery,
      removeQuery,
      clearQueries,
    }),
    [documents, recentQueries],
  );

  return <DocumentsCtx.Provider value={value}>{children}</DocumentsCtx.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsCtx);
  if (!ctx) throw new Error("useDocuments must be used within <DocumentsProvider />");
  return ctx;
}
