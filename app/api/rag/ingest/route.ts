// app/api/rag/ingest/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParsedBlock = { id: string; label: string; content: string };

function extOf(name = "") {
  return (name.split(".").pop() || "").toLowerCase();
}

function splitToBlocks(text: string, blockSize = 1200): ParsedBlock[] {
  const out: ParsedBlock[] = [];
  const clean = (text || "").replace(/\r/g, "").trim();
  if (!clean) return [{ id: "1", label: "Text 1", content: "(empty file)" }];
  let i = 0, idx = 1;
  while (i < clean.length) {
    out.push({ id: String(idx), label: `Text ${idx}`, content: clean.slice(i, i + blockSize).trim() });
    i += blockSize; idx++;
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "File tidak ditemukan di FormData." }, { status: 400 });
    }

    const f = file as File;
    const name = (f as any).name || "document";
    const mime = f.type || "";
    const ext = extOf(name);

    if (typeof f.size === "number" && f.size === 0) {
      return NextResponse.json({ error: "File kosong (size = 0)." }, { status: 400 });
    }

    const ab = await f.arrayBuffer();
    if (!ab || ab.byteLength === 0) {
      return NextResponse.json({ error: "Gagal membaca data file (arrayBuffer kosong)." }, { status: 400 });
    }
    const buf = Buffer.from(ab);

    let text = "";

    // ===== PDF =====
    if (mime.includes("pdf") || ext === "pdf") {
      try {
        // Simple PDF parsing fallback - just return file info for now
        // TODO: Implement proper PDF parsing later
        text = `PDF File: ${name}\nSize: ${f.size} bytes\nType: PDF Document\nNote: PDF content parsing is temporarily disabled. Please use TXT, DOCX, or image files for now.`;
      } catch (pdfError: any) {
        console.error("PDF Parse Error:", pdfError);
        text = `PDF File: ${name}\nSize: ${f.size} bytes\nError: ${pdfError.message}`;
      }
    }

    // ===== TXT / MD / CSV / LOG =====
    else if (
      mime.startsWith("text/") ||
      ["txt", "md", "csv", "log"].includes(ext)
    ) {
      text = buf.toString("utf8");
    }

    // ===== DOCX =====
    else if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      try {
        const mammoth: any = await import("mammoth");
        const { value } = await mammoth.extractRawText({ buffer: buf });
        text = String(value || "").trim();
      } catch (docxError: any) {
        console.error("DOCX Parse Error:", docxError);
        text = `DOCX File: ${name}\nSize: ${f.size} bytes\nError: ${docxError.message}`;
      }
    }

    // ===== IMAGE (OCR) =====
    else if (
      ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ||
      mime.startsWith("image/")
    ) {
      try {
        const tesseract: any = await import("tesseract.js");
        // default model bahasa Inggris; ganti 'ind' jika mau pakai model Indonesia
        const { data } = await tesseract.createWorker("eng").then(async (worker: any) => {
          const res = await worker.recognize(buf);
          await worker.terminate();
          return res;
        });
        text = String(data?.text || "").trim();
      } catch (ocrError: any) {
        console.error("OCR Error:", ocrError);
        text = `Image File: ${name}\nSize: ${f.size} bytes\nError: ${ocrError.message}`;
      }
    }

    // ===== belum didukung =====
    else {
      return NextResponse.json(
        { error: `Tipe file .${ext} belum didukung. Gunakan PDF, DOCX, TXT/MD atau gambar (PNG/JPG/JPEG/WEBP/GIF).` },
        { status: 415 }
      );
    }

    const parsedBlocks = splitToBlocks(text);
    return NextResponse.json({ parsedBlocks });
  } catch (e: any) {
    console.error("INGEST ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Gagal memproses file." },
      { status: 500 }
    );
  }
}
