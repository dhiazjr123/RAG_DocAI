// app/api/rag/ingest/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParsedBlock = { id: string; label: string; content: string };

function extOf(name = "") {
  return (name.split(".").pop() || "").toLowerCase();
}

function asBlocksFromLines(lines: string[]): ParsedBlock[] {
  if (!lines?.length) return [{ id: "1", label: "Text 1", content: "(empty)" }];
  return lines.map((l, i) => ({ id: String(i + 1), label: `Row ${i + 1}`, content: l.trim() }));
}

// fallback lama (pdf-parse) – tetap ada
async function pdfParseFallback(buf: Buffer): Promise<string> {
  const pdfParse = await import("pdf-parse");
  const data = await pdfParse.default(buf);
  return String(data.text || "").trim();
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

    const ab = await f.arrayBuffer();
    const buf = Buffer.from(ab);

    let parsedBlocks: ParsedBlock[] = [];
    let usedDocling = false;

    // ======= 0) Coba Docling lokal via Python (tanpa service HTTP) =======
    try {
      const mod: any = await import("@/lib/doclingExtractor");
      if (mod && typeof mod.extractDocument === "function") {
        const result = await mod.extractDocument(buf, name, mime);
        if (result?.success) {
          const text = String(result.text || "");
          const lines = text.split(/\r?\n/).filter(Boolean);
          parsedBlocks = asBlocksFromLines(lines);
          usedDocling = true;
        }
      }
    } catch {
      // diam-diam lanjut ke opsi lain
    }

    // ======= 1) Coba Docling service jika tersedia =======
    const DOC_SERVICE_URL = process.env.DOC_SERVICE_URL || "http://localhost:8008/extract";
    try {
      // hanya untuk PDF / DOCX
      if (!parsedBlocks.length && (ext === "pdf" || mime.includes("pdf") || ext === "docx")) {
        const fd = new FormData();
        fd.append("file", new Blob([buf], { type: mime || "application/pdf" }), name);

        const r = await fetch(DOC_SERVICE_URL, { method: "POST", body: fd as any });
        if (r.ok) {
          const j: any = await r.json();
          const rowLines: string[] = j?.row_lines || [];
          if (rowLines.length) {
            parsedBlocks = asBlocksFromLines(rowLines);
            usedDocling = true;
          } else if (j?.raw_text) {
            // fallback ke raw markdown dari docling
            const lines = String(j.raw_text).split(/\r?\n/).filter(Boolean);
            parsedBlocks = asBlocksFromLines(lines);
            usedDocling = true;
          }
        }
      }
    } catch {
      // diam-diam fallback
    }

    // ======= 2) Fallback ke parser lama bila Docling gagal =======
    if (!parsedBlocks.length) {
      const text = await pdfParseFallback(buf);
      const lines = text.split(/\r?\n/).filter(l => /^\d+\.\s+/.test(l.trim()));
      parsedBlocks = lines.length
        ? asBlocksFromLines(lines)
        : asBlocksFromLines(text.split(/\r?\n/));
    }

    return NextResponse.json({ parsedBlocks, usedDocling });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memproses file." }, { status: 500 });
  }
}
