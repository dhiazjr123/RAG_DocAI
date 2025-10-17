// lib/ragLocal.ts
// Client-side RAG: parse → chunk → embed → retrieve (no server)

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// Configure pdf.js worker using a bundled module URL to avoid CDN dynamic import issues
// Prefer worker from public/ to avoid dynamic import limitation
// @ts-ignore
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// Embedding model (loaded on-demand)
type EmbeddingModel = {
  embed: (texts: string[]) => Promise<Float32Array[]>;
};

let modelPromise: Promise<EmbeddingModel> | null = null;

async function loadEmbedder(): Promise<EmbeddingModel> {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    const { pipeline } = await import("@xenova/transformers");
    const hl = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,
    });
    return {
      async embed(texts: string[]) {
        const out: Float32Array[] = [];
        for (const t of texts) {
          const res: any = await hl(t, { pooling: "mean", normalize: true });
          // res is a Tensor; convert to Float32Array
          const arr = new Float32Array(res.data.length);
          arr.set(res.data);
          out.push(arr);
        }
        return out;
      },
    } as EmbeddingModel;
  })();
  return modelPromise;
}

/* ================= Parsing ================= */

export async function parseFileToText(file: File): Promise<{ text: string; meta?: Record<string, any> }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".txt")) return parseTxt(file);
  // Fallback: try read as text
  try {
    const text = await file.text();
    return { text };
  } catch {
    return { text: "" };
  }
}

async function parseTxt(file: File): Promise<{ text: string }> {
  const text = await file.text();
  return { text };
}

async function parsePdf(file: File): Promise<{ text: string; meta?: Record<string, any> }> {
  const uint8 = new Uint8Array(await file.arrayBuffer());
  const doc = await getDocument({ data: uint8 }).promise;
  let full = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((i: any) => (typeof i.str === "string" ? i.str : ""));
    // Normalize whitespace to reduce noise and size
    const normalized = strings.join(" ").replace(/\s+/g, " ").trim();
    full += normalized + "\n\n";
  }
  let meta: Record<string, any> | undefined;
  try {
    const info = await doc.getMetadata();
    meta = { info: info.info, metadata: info.metadata }; // may contain Title, Author
  } catch {}
  return { text: full, meta };
}

/* ================= Chunking ================= */

export type Chunk = {
  id: string;
  docId: string;
  start: number;
  end: number;
  text: string;
};

export function chunkText(docId: string, text: string, opts?: { chunkSize?: number; overlap?: number; minLen?: number }): Chunk[] {
  const chunkSize = opts?.chunkSize ?? 800; // characters
  const overlap = opts?.overlap ?? 120;
  const minLen = opts?.minLen ?? 40;
  const chunks: Chunk[] = [];
  
  // Enhanced chunking: try to preserve table-like structures and important patterns
  const enhancedChunks = createEnhancedChunks(docId, text, chunkSize, overlap, minLen);
  if (enhancedChunks.length > 0) {
    return enhancedChunks;
  }
  
  // Fallback to standard chunking
  let i = 0;
  while (i < text.length) {
    const start = i;
    const end = Math.min(text.length, i + chunkSize);
    const piece = text.slice(start, end);
    const id = `${docId}-${start}-${end}`;
    const trimmed = piece.replace(/\s+/g, " ").trim();
    if (trimmed.length >= minLen) {
      chunks.push({ id, docId, start, end, text: trimmed });
    }
    if (end === text.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

/**
 * Enhanced chunking that preserves important patterns and table-like structures
 */
function createEnhancedChunks(docId: string, text: string, chunkSize: number, overlap: number, minLen: number): Chunk[] {
  const chunks: Chunk[] = [];
  
  // Split by lines first to better preserve structure
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWithNewline = line + '\n';
    
    // Check if adding this line would exceed chunk size
    if (currentChunk.length + lineWithNewline.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      const trimmed = currentChunk.replace(/\s+/g, ' ').trim();
      if (trimmed.length >= minLen) {
        const end = currentStart + currentChunk.length;
        chunks.push({
          id: `${docId}-${currentStart}-${end}`,
          docId,
          start: currentStart,
          end,
          text: trimmed
        });
      }
      
      // Start new chunk with overlap
      const overlapText = getOverlapText(currentChunk, overlap);
      currentChunk = overlapText + lineWithNewline;
      currentStart += currentChunk.length - overlapText.length - lineWithNewline.length;
      chunkIndex++;
    } else {
      currentChunk += lineWithNewline;
    }
    
    // Special handling for lines that look like table rows or important data
    if (isImportantLine(line)) {
      // Try to include surrounding context
      let contextLines = [line];
      
      // Look ahead for related lines
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (isRelatedLine(lines[j], line)) {
          contextLines.push(lines[j]);
        } else {
          break;
        }
      }
      
      // Create special chunk for important data
      const importantText = contextLines.join('\n');
      const trimmed = importantText.replace(/\s+/g, ' ').trim();
      if (trimmed.length >= minLen && trimmed.length <= chunkSize) {
        const start = text.indexOf(importantText);
        const end = start + importantText.length;
        chunks.push({
          id: `${docId}-important-${chunkIndex}-${start}-${end}`,
          docId,
          start,
          end,
          text: trimmed
        });
        chunkIndex++;
      }
    }
  }
  
  // Add remaining chunk
  if (currentChunk.length > 0) {
    const trimmed = currentChunk.replace(/\s+/g, ' ').trim();
    if (trimmed.length >= minLen) {
      const end = currentStart + currentChunk.length;
      chunks.push({
        id: `${docId}-${currentStart}-${end}`,
        docId,
        start: currentStart,
        end,
        text: trimmed
      });
    }
  }
  
  return chunks;
}

function isImportantLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  
  // Check for patterns that indicate important financial/administrative data
  return (
    // Monetary amounts
    /rp\s*[0-9.,]+/i.test(line) ||
    /[0-9.,]+\s*(rupiah|rb|juta|miliar)/i.test(line) ||
    
    // PKB related
    /pkb/i.test(line) ||
    
    // Denda related
    /denda/i.test(line) ||
    
    // Administrative terms
    /\b(kasir|samsat|kantor|sewon|bantul|yogyakarta|jogja)\b/i.test(line) ||
    
    // Table-like structures (multiple numbers or structured data)
    (line.match(/[0-9.,]+/g)?.length >= 2) ||
    
    // Lines with colons (often indicate labels)
    /:/i.test(line) ||
    
    // Lines that look like headers or titles
    /^[A-Z\s]+$/i.test(line.trim()) && line.trim().length < 50
  );
}

function isRelatedLine(line: string, referenceLine: string): boolean {
  const lowerLine = line.toLowerCase();
  const lowerRef = referenceLine.toLowerCase();
  
  // Check if lines share common patterns
  return (
    // Both have monetary amounts
    (/rp\s*[0-9.,]+/i.test(line) && /rp\s*[0-9.,]+/i.test(referenceLine)) ||
    
    // Both have similar administrative terms
    /\b(kasir|samsat|kantor|pkb|denda)\b/i.test(line) && /\b(kasir|samsat|kantor|pkb|denda)\b/i.test(referenceLine) ||
    
    // Both have numbers (likely table rows)
    (!!line.match(/[0-9.,]+/g) && !!referenceLine.match(/[0-9.,]+/g)) ||
    
    // Similar structure (both have colons or similar formatting)
    ((/:/i.test(line) && /:/i.test(referenceLine)) ||
     (line.length < 100 && referenceLine.length < 100))
  );
}

function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) return text;
  
  // Try to find a good break point (end of word, line, etc.)
  const overlapStart = text.length - overlapSize;
  let breakPoint = overlapStart;
  
  // Look for word boundaries
  for (let i = overlapStart; i < text.length; i++) {
    if (text[i] === ' ' || text[i] === '\n') {
      breakPoint = i + 1;
      break;
    }
  }
  
  return text.slice(breakPoint);
}

/* ================= Similarity ================= */

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* ================= IndexedDB (separate DB) ================= */

const IDB_NAME = "rag-idx-db";
const IDB_VERSION = 1;
const STORE_CHUNKS = "chunks"; // key: chunkId value: Chunk
const STORE_VECS = "vecs"; // key: chunkId value: Float32Array (as Blob)
const STORE_META = "meta";   // key: docId  value: any (document-level metadata)

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) db.createObjectStore(STORE_CHUNKS);
      if (!db.objectStoreNames.contains(STORE_VECS)) db.createObjectStore(STORE_VECS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store: string, key: string, value: any) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  const val = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return val;
}

async function dbDeleteByPrefix(store: string, prefix: string) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const req = os.openCursor();
    req.onsuccess = (e: any) => {
      const cursor: IDBCursorWithValue | null = e.target.result;
      if (!cursor) return;
      const key = String(cursor.key);
      if (key.startsWith(prefix)) os.delete(cursor.key);
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/* ================= Build Index ================= */

export type BuildProgress = (stage: "parse" | "chunk" | "embed" | "persist", info?: any) => void;

export async function buildIndexForDocument(docId: string, file: File, onProgress?: BuildProgress) {
  onProgress?.("parse");
  const { text, meta } = await parseFileToText(file);

  onProgress?.("chunk");
  let chunks = chunkText(docId, text);
  // Limit max chunks to avoid OOM/crash on large PDFs
  const MAX_CHUNKS = 1200;
  if (chunks.length > MAX_CHUNKS) {
    chunks = chunks.slice(0, MAX_CHUNKS);
  }

  onProgress?.("embed", { total: chunks.length });
  const embedder = await loadEmbedder();
  const embeddings: Float32Array[] = [];
  const batchSize = 4; // smaller batches for stability in browsers
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchTexts = chunks.slice(i, i + batchSize).map((c) => c.text);
    const vecs = await embedder.embed(batchTexts);
    embeddings.push(...vecs);
    onProgress?.("embed", { done: Math.min(i + batchSize, chunks.length), total: chunks.length });
    // Yield to UI thread
    await new Promise((r) => setTimeout(r, 0));
  }

  onProgress?.("persist");
  // Persist chunks & vectors (as Blob for vecs)
  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    await dbPut(STORE_CHUNKS, ch.id, ch);
    // Convert Float32Array to Uint8Array for Blob storage
    const float32Array = embeddings[i];
    const uint8Array = new Uint8Array(float32Array.buffer as ArrayBuffer, float32Array.byteOffset, float32Array.byteLength);
    const vecBlob = new Blob([uint8Array], { type: "application/octet-stream" });
    await dbPut(STORE_VECS, ch.id, vecBlob);
  }
  
  // Persist document-level metadata
  if (meta) await dbPut(STORE_META, docId, meta);

  return { chunks, meta };
}

export async function deleteIndexForDocument(docId: string) {
  await dbDeleteByPrefix(STORE_CHUNKS, `${docId}-`);
  await dbDeleteByPrefix(STORE_VECS, `${docId}-`);
  await dbDeleteByPrefix(STORE_META, docId);
}

/* ================= Retrieval ================= */

export type Retrieved = { chunk: Chunk; score: number };

export async function retrieveTopK(query: string, topK = 6, opts?: { docId?: string }): Promise<Retrieved[]> {
  const embedder = await loadEmbedder();
  const [qVec] = await embedder.embed([query]);

  // Iterate all vectors
  const db = await openDB();
  const chunks: Chunk[] = [];
  const vecs: Float32Array[] = [];
  await new Promise<void>((resolve, reject) => {
    let remaining = 2;
    const done = () => { if (--remaining === 0) resolve(); };

    // Load chunks
    const tx1 = db.transaction(STORE_CHUNKS, "readonly");
    const os1 = tx1.objectStore(STORE_CHUNKS);
    const req1 = os1.openCursor();
    req1.onsuccess = (e: any) => {
      const cursor: IDBCursorWithValue | null = e.target.result;
      if (!cursor) return;
      const ch = cursor.value as Chunk;
      if (!opts?.docId || ch.docId === opts.docId) {
        chunks.push(ch);
      }
      cursor.continue();
    };
    tx1.oncomplete = done;
    tx1.onerror = () => reject(tx1.error);

    // Load vectors
    const tx2 = db.transaction(STORE_VECS, "readonly");
    const os2 = tx2.objectStore(STORE_VECS);
    const req2 = os2.openCursor();
    req2.onsuccess = (e: any) => {
      const cursor: IDBCursorWithValue | null = e.target.result;
      if (!cursor) return;
      const blob: Blob = cursor.value as Blob;
      blob.arrayBuffer().then((buf) => {
        vecs.push(new Float32Array(buf));
        cursor.continue();
      });
    };
    tx2.oncomplete = done;
    tx2.onerror = () => reject(tx2.error);
  });
  db.close();

  // Build map chunkId -> index for aligning
  const idToIdx: Record<string, number> = {};
  for (let i = 0; i < chunks.length; i++) idToIdx[chunks[i].id] = i;

  // If counts mismatch, align by scanning vecs via chunks order assumption
  const results: Retrieved[] = [];
  const N = Math.min(chunks.length, vecs.length);
  for (let i = 0; i < N; i++) {
    const score = cosineSimilarity(qVec, vecs[i]);
    results.push({ chunk: chunks[i], score });
  }
  
  // Enhanced scoring: boost scores for chunks that contain specific patterns
  const enhancedResults = enhanceScoresForSpecificQueries(query, results);
  
  enhancedResults.sort((a, b) => b.score - a.score);
  
  // Deduplicate by overlapping ranges and prefer higher scores
  const picked: Retrieved[] = [];
  const seen: string[] = [];
  for (const r of enhancedResults) {
    const key = `${r.chunk.docId}-${Math.floor(r.chunk.start / 200)}`; // coarse bucket to avoid adjacent duplicates
    if (seen.includes(key)) continue;
    seen.push(key);
    picked.push(r);
    if (picked.length >= topK) break;
  }
  return picked;
}

/**
 * Enhance scores for chunks that contain specific patterns relevant to the query
 */
function enhanceScoresForSpecificQueries(query: string, results: Retrieved[]): Retrieved[] {
  const q = query.toLowerCase();
  
  return results.map(result => {
    let enhancedScore = result.score;
    const text = result.chunk.text.toLowerCase();
    
    // Boost score for chunks containing specific keywords from the query
    const queryWords = q.split(/\s+/).filter(word => word.length > 2);
    const matchedWords = queryWords.filter(word => text.includes(word));
    
    if (matchedWords.length > 0) {
      enhancedScore += matchedWords.length * 0.1; // Boost by 0.1 per matched word
    }
    
    // Special boosts for specific patterns
    if (/\bdenda\b/.test(q) && text.includes('denda')) {
      enhancedScore += 0.3; // Significant boost for denda queries
    }
    
    if (/\bpkb\b/.test(q) && text.includes('pkb')) {
      enhancedScore += 0.3; // Significant boost for PKB queries
    }
    
    if (/\b(kasir|samsat|sewon)\b/.test(q)) {
      const locationMatches = (q.match(/\b(kasir|samsat|sewon)\b/g) || []).filter(loc => text.includes(loc));
      enhancedScore += locationMatches.length * 0.2;
    }
    
    // Boost for chunks containing monetary amounts when query asks for amounts
    if (/\b(berapa|jumlah|total|harga|biaya|nilai)\b/.test(q) && /rp\s*[0-9.,]+/i.test(result.chunk.text)) {
      enhancedScore += 0.2;
    }
    
    // Boost for chunks with table-like data (multiple numbers)
    if (result.chunk.text.match(/[0-9.,]+/g) && result.chunk.text.match(/[0-9.,]+/g)!.length >= 2) {
      enhancedScore += 0.1;
    }
    
    // Boost for important chunks (marked with "important" in ID)
    if (result.chunk.id.includes('important')) {
      enhancedScore += 0.2;
    }
    
    return {
      ...result,
      score: Math.min(enhancedScore, 1.0) // Cap at 1.0
    };
  });
}


export function buildAnswerFromChunks(query: string, retrieved: Retrieved[]): { answer: string; sources: Array<{ docId: string; excerpt: string; range: [number, number] }> } {
  if (!retrieved.length || retrieved[0].score < 0.1) {
    return { answer: "Maaf, tidak ditemukan informasi yang relevan dalam dokumen.", sources: [] };
  }
  
  const q = query.toLowerCase();
  
  // Enhanced pattern matching for specific queries
  const answer = extractSpecificInformation(q, retrieved);
  if (answer) {
    return answer;
  }
  
  // Prefer extracting likely title for queries containing "judul"/"title"
  if (/\b(judul|title)\b/.test(q)) {
    // heuristic: look into top chunks for lines with Title-like patterns or first significant line
    for (const r of retrieved.slice(0, 4)) {
      const lines = r.chunk.text.split(/\n|\.\s+/).map((s) => s.trim()).filter(Boolean);
      const candidate = lines.find((s) => /^title\s*[:\-]/i.test(s)) || lines[0];
      if (candidate && candidate.length > 4 && candidate.length < 220) {
        const answer = `Judul yang terdeteksi (heuristik): "${candidate.replace(/^title\s*[:\-]\s*/i, "")}"`;
        const sources = retrieved.slice(0, 3).map((r) => ({ docId: r.chunk.docId, excerpt: r.chunk.text.slice(0, 240), range: [r.chunk.start, r.chunk.end] as [number, number] }));
        return { answer, sources };
      }
    }
  }

  const pieces = retrieved.map((r) => `• ${r.chunk.text.trim()}`).slice(0, 3);
  const defaultAnswer = [
    `Berikut kutipan yang paling relevan berdasarkan pertanyaan Anda:`,
    ...pieces,
  ].join("\n");
  const sources = retrieved.slice(0, 6).map((r) => ({ docId: r.chunk.docId, excerpt: r.chunk.text.slice(0, 240), range: [r.chunk.start, r.chunk.end] as [number, number] }));
  return { answer: defaultAnswer, sources };
}

/**
 * Enhanced information extraction for specific query patterns
 * Handles queries like "denda di PKB dari kasir samsat sewon"
 */
function extractSpecificInformation(query: string, retrieved: Retrieved[]): { answer: string; sources: Array<{ docId: string; excerpt: string; range: [number, number] }> } | null {
  const q = query.toLowerCase();
  
  // Pattern 1: Denda queries (denda di PKB, denda pajak, etc.)
  if (/\bdenda\b/.test(q)) {
    const dendaInfo = extractDendaInfo(q, retrieved);
    if (dendaInfo) return dendaInfo;
  }
  
  // Pattern 2: Amount queries (berapa, berapa rupiah, jumlah, total)
  if (/\b(berapa|jumlah|total|harga|biaya|nilai)\b/.test(q)) {
    const amountInfo = extractAmountInfo(q, retrieved);
    if (amountInfo) return amountInfo;
  }
  
  // Pattern 3: Location queries (kasir samsat sewon, di kantor, etc.)
  if (/\b(kasir|samsat|kantor|lokasi|tempat)\b/.test(q)) {
    const locationInfo = extractLocationInfo(q, retrieved);
    if (locationInfo) return locationInfo;
  }
  
  // Pattern 4: PKB specific queries
  if (/\bpkb\b/.test(q)) {
    const pkbInfo = extractPKBInfo(q, retrieved);
    if (pkbInfo) return pkbInfo;
  }
  
  return null;
}

function extractDendaInfo(query: string, retrieved: Retrieved[]): { answer: string; sources: Array<{ docId: string; excerpt: string; range: [number, number] }> } | null {
  const q = query.toLowerCase();
  
  // Look for denda-related content
  for (const r of retrieved) {
    const text = r.chunk.text.toLowerCase();
    
    // Check if this chunk contains denda information
    if (text.includes('denda') || text.includes('denda') || text.includes('denda')) {
      // Try to extract specific denda amount
      const dendaMatch = r.chunk.text.match(/(denda|denda)[\s:]*([0-9.,]+)/gi);
      if (dendaMatch) {
        const dendaAmount = dendaMatch[0];
        const answer = `Berdasarkan dokumen, ${dendaAmount}`;
        return {
          answer,
          sources: [{ docId: r.chunk.docId, excerpt: r.chunk.text.slice(0, 300), range: [r.chunk.start, r.chunk.end] }]
        };
      }
      
      // If no specific amount, return the relevant text
      const lines = r.chunk.text.split('\n').filter(line => 
        line.toLowerCase().includes('denda') || 
        line.includes('Rp') || 
        line.match(/[0-9.,]+/)
      );
      
      if (lines.length > 0) {
        const answer = `Informasi denda yang ditemukan:\n${lines.join('\n')}`;
        return {
          answer,
          sources: [{ docId: r.chunk.docId, excerpt: r.chunk.text.slice(0, 300), range: [r.chunk.start, r.chunk.end] }]
        };
      }
    }
  }
  
  return null;
}

function extractAmountInfo(query: string, retrieved: Retrieved[]): { answer: string; sources: Array<{ docId: string; excerpt: string; range: [number, number] }> } | null {
  const q = query.toLowerCase();
  
  for (const r of retrieved) {
    const text = r.chunk.text;
    
    // Look for monetary amounts (Rp, rupiah, numbers with commas/dots)
    const amountMatches = text.match(/(Rp\s*[0-9.,]+|rupiah\s*[0-9.,]+|[0-9.,]+\s*(rupiah|rb|juta|miliar))/gi);
    
    if (amountMatches && amountMatches.length > 0) {
      // If query mentions specific context (PKB, denda, etc.)
      const contextMatches = text.toLowerCase().match(/\b(pkb|denda|pokok|pajak|samsat|kasir)\b/g);
      
      if (contextMatches && contextMatches.length > 0) {
        const answer = `Berdasarkan dokumen, ditemukan informasi:\n${amountMatches.slice(0, 3).map(amount => `• ${amount}`).join('\n')}`;
        return {
          answer,
          sources: [{ docId: r.chunk.docId, excerpt: text.slice(0, 300), range: [r.chunk.start, r.chunk.end] }]
        };
      }
    }
  }
  
  return null;
}

function extractLocationInfo(query: string, retrieved: Retrieved[]): { answer: string; sources: Array<{ docId: string; excerpt: string; range: [number, number] }> } | null {
  const q = query.toLowerCase();
  
  // Extract location keywords from query
  const locationKeywords = q.match(/\b(samsat|kasir|kantor|sewon|bantul|yogyakarta|jogja)\b/g) || [];
  
  for (const r of retrieved) {
    const text = r.chunk.text.toLowerCase();
    
    // Check if chunk contains any of the location keywords
    const foundLocations = locationKeywords.filter(keyword => text.includes(keyword));
    
    if (foundLocations.length > 0) {
      // Look for relevant information near these locations
      const lines = r.chunk.text.split('\n').filter(line => {
        const lineLower = line.toLowerCase();
        return foundLocations.some(loc => lineLower.includes(loc)) ||
               line.includes('Rp') ||
               line.match(/[0-9.,]+/);
      });
      
      if (lines.length > 0) {
        const answer = `Informasi terkait ${foundLocations.join(', ')}:\n${lines.slice(0, 5).join('\n')}`;
        return {
          answer,
          sources: [{ docId: r.chunk.docId, excerpt: r.chunk.text.slice(0, 300), range: [r.chunk.start, r.chunk.end] }]
        };
      }
    }
  }
  
  return null;
}

function extractPKBInfo(query: string, retrieved: Retrieved[]): { answer: string; sources: Array<{ docId: string; excerpt: string; range: [number, number] }> } | null {
  const q = query.toLowerCase();
  
  for (const r of retrieved) {
    const text = r.chunk.text.toLowerCase();
    
    if (text.includes('pkb')) {
      // Look for PKB-related information with amounts
      const pkbLines = r.chunk.text.split('\n').filter(line => {
        const lineLower = line.toLowerCase();
        return lineLower.includes('pkb') || 
               line.includes('Rp') ||
               line.match(/[0-9.,]+/);
      });
      
      if (pkbLines.length > 0) {
        const answer = `Informasi PKB yang ditemukan:\n${pkbLines.slice(0, 5).join('\n')}`;
        return {
          answer,
          sources: [{ docId: r.chunk.docId, excerpt: r.chunk.text.slice(0, 300), range: [r.chunk.start, r.chunk.end] }]
        };
      }
    }
  }
  
  return null;
}

/* ================= Utilities: read index & extract heuristics ================= */

export async function listChunksForDocument(docId: string): Promise<Chunk[]> {
  const db = await openDB();
  const chunks: Chunk[] = [];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, "readonly");
    const os = tx.objectStore(STORE_CHUNKS);
    const req = os.openCursor();
    req.onsuccess = (e: any) => {
      const cursor: IDBCursorWithValue | null = e.target.result;
      if (!cursor) return;
      const ch = cursor.value as Chunk;
      if (ch.docId === docId) chunks.push(ch);
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  chunks.sort((a, b) => a.start - b.start);
  return chunks;
}

export async function getMetaForDocument(docId: string): Promise<any | undefined> {
  return dbGet<any>(STORE_META, docId);
}

export async function extractHeuristics(docId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const meta = await getMetaForDocument(docId);
  if (meta?.info) {
    if (meta.info.Title) out.title = String(meta.info.Title);
    if (meta.info.Author) out.authors = String(meta.info.Author);
  }
  const chunks = await listChunksForDocument(docId);
  const headText = chunks.slice(0, 5).map((c) => c.text).join(" \n ");
  const lines = headText.split(/\n|\r|\.\s+/).map((s) => s.trim()).filter(Boolean);

  // Title detection
  if (!out.title) {
    const cand = lines.find((s) => /^title\s*[:\-]/i.test(s)) || lines.find((s) => s.length > 8 && s.length < 160);
    if (cand) out.title = cand.replace(/^title\s*[:\-]\s*/i, "");
  }
  // Authors simple heuristic (look for ; or , with 2-5 tokens)
  if (!out.authors) {
    const cand = lines.find((s) => /(author|penulis)\s*[:\-]/i.test(s))
      || lines.find((s) => /[A-Za-z]{2,}\s+[A-Za-z]{2,}(;|,)/.test(s));
    if (cand) out.authors = cand.replace(/^(author|penulis)\s*[:\-]\s*/i, "");
  }
  // Year detection (2000-2099)
  const yearMatch = headText.match(/\b(20\d{2})\b/);
  if (yearMatch) out.year = yearMatch[1];

  return out;
}


