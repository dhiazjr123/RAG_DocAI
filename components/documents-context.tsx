// components/documents-context.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { deleteIndexForDocument } from "@/lib/ragLocal";
import { createClient } from "@/lib/supabase/client";
import { addActivity } from "@/lib/activity-tracker";

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

// Helper untuk membuat localStorage key yang unique per user
function getLSDocsKey(userId: string | null) {
  return userId ? `rag_docs_v1_${userId}` : "rag_docs_v1_guest";
}

function getLSQueriesKey(userId: string | null) {
  return userId ? `rag_recent_queries_v1_${userId}` : "rag_recent_queries_v1_guest";
}

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
const IDB_VERSION = 2; // Increment version untuk upgrade schema
const STORE_FILES = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES); // key = userId:docId (string)
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helper untuk membuat composite key: userId:docId
function makeFileKey(userId: string | null, docId: string): string {
  const uid = userId || "guest";
  return `${uid}:${docId}`;
}

async function idbPutFile(userId: string | null, docId: string, blob: Blob) {
  const db = await openDB();
  const key = makeFileKey(userId, docId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readwrite");
    tx.objectStore(STORE_FILES).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGetFile(userId: string | null, docId: string): Promise<Blob | undefined> {
  const db = await openDB();
  const key = makeFileKey(userId, docId);
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readonly");
    const req = tx.objectStore(STORE_FILES).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function idbDeleteFile(userId: string | null, docId: string) {
  const db = await openDB();
  const key = makeFileKey(userId, docId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readwrite");
    tx.objectStore(STORE_FILES).delete(key);
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
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  /* ---------- Get current user ID dari Supabase ---------- */
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) {
          const uid = data?.user?.id || null;
          setUserId(uid);
          console.log("User ID set:", uid);
        }
      } catch (e) {
        console.error("Error getting user:", e);
        if (mounted) {
          setUserId(null);
        }
      }
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        const uid = session?.user?.id || null;
        setUserId(uid);
        console.log("Auth state changed:", event, "New user ID:", uid);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  /* ---------- HYDRATE dari localStorage + IndexedDB (per user) ---------- */
  useEffect(() => {
    // Jika belum login → kosongkan state tapi biarkan data di localStorage
    if (!userId) {
      console.log("No user logged in, clearing in-memory state but keeping localStorage");
      setDocuments([]);
      setRecentQueries([]);
      setHydrated(false);
      return;
    }

    setHydrated(false);
    
    let mounted = true;

    (async () => {
      try {
        console.log("Hydrating documents/queries for user:", userId);

        const docsKey = getLSDocsKey(userId);
        const queriesKey = getLSQueriesKey(userId);

        const metaJson = localStorage.getItem(docsKey);
        const metas: DocMeta[] = metaJson ? JSON.parse(metaJson) : [];
        console.log("Loaded metadata from LS:", metas.length, "documents");

        const restored: DocRow[] = await Promise.all(
          metas.map(async (m) => {
            let file: File | undefined;
            try {
              const blob = await idbGetFile(userId, m.id);
              if (blob) {
                file = new File([blob], m.name, { type: mimeFromExt(m.type) });
              }
            } catch (error) {
              console.warn("Failed to load file from IndexedDB:", m.id, error);
            }
            return { ...m, file };
          }),
        );

        if (!mounted) return;

        setDocuments(restored);
        console.log("Documents restored:", restored.length);

        const rqJson = localStorage.getItem(queriesKey);
        const rq: RecentQuery[] = rqJson ? JSON.parse(rqJson) : [];
        if (!mounted) return;

        setRecentQueries(rq);
        console.log("Queries restored:", rq.length);
      } catch (e) {
        console.error("Gagal hydrate:", e);
      } finally {
        if (mounted) {
          setHydrated(true);
          console.log("Hydration completed for user:", userId);
        }
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, [userId]);

  /* ---------- Persist otomatis saat state berubah (per user) ---------- */
  useEffect(() => {
    if (!hydrated || userId === null) return; // Skip if not hydrated or no user

    const metas: DocMeta[] = documents.map(({ file, ...meta }) => meta);
    const docsKey = getLSDocsKey(userId);

    localStorage.setItem(docsKey, JSON.stringify(metas));
    console.log("Saved documents to localStorage:", docsKey, metas.length);
  }, [documents, hydrated, userId]);

  useEffect(() => {
    if (!hydrated || userId === null) return; // Skip if not hydrated or no user

    const queriesKey = getLSQueriesKey(userId);

    localStorage.setItem(queriesKey, JSON.stringify(recentQueries));
    console.log("Saved queries to localStorage:", queriesKey, recentQueries.length);
  }, [recentQueries, hydrated, userId]);

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

    // simpan file ke IndexedDB (async) dengan userId
    rows.forEach((r) => {
      if (r.file) {
        idbPutFile(userId, r.id, r.file).catch((e) => console.error("Gagal simpan file ke IDB:", e));
      }
    });

    // simulasi selesai proses
    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (rows.some((r) => r.id === d.id) && d.status === "Processing") {
            // Track activity when document is processed (only once when status changes)
            addActivity(userId, "document_processed", `Processed document "${d.name}"`, {
              documentName: d.name,
            });
            return { ...d, status: "Processed" };
          }
          return d;
        }),
      );
    }, 1200);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    idbDeleteFile(userId, id).catch((e) => console.error("Gagal hapus file di IDB:", e));
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
    
    // Track activity
    const queryPreview = text.length > 50 ? text.substring(0, 50) + "..." : text;
    addActivity(userId, "query_made", `Asked query about "${queryPreview}"`, {
      queryText: text,
    });
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
