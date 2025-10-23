// app/api/rag/query/route.ts
import { NextResponse } from "next/server";
import { parseTableFromText, findRowByName } from "@/lib/parse-yogyakarta-pajak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

function rupiah(n: number) {
  try {
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
  } catch {
    return `Rp ${n}`;
  }
}

function normalize(s = "") {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractJenisDanSub(query: string) {
  const q = normalize(query);
  const jenis =
    /bbnkb\s*ii\b/.test(q) ? "bbnkb2" :
    /bbnkb\b/.test(q) ? "bbnkb1" :
    /swdkllj/.test(q) ? "swdkllj" : "pkb";

  const sub =
    /denda/.test(q) ? "denda" :
    /pokok/.test(q) ? "pokok" : "jumlah";

  return { jenis, sub };
}

function extractNama(query: string) {
  const q = query;
  // ambil frasa setelah "nama kasir", "nama kppd", atau "dari"
  const m = q.match(/(?:nama\s+(?:kasir|kppd)|dari)\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export async function POST(req: Request) {
  try {
    const { query, context } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Query kosong." }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // === batasi context
    const MAX_CONTEXT_CHARS = 25000;
    let limitedContext = context || "(no context)";
    if (limitedContext.length > MAX_CONTEXT_CHARS) {
      limitedContext = limitedContext.substring(0, MAX_CONTEXT_CHARS) + "\n\n[... context truncated ...]";
    }

    // === 1) JALUR DETERMINISTIK (parser angka -> jawaban)
    const rows = parseTableFromText(limitedContext);
    const { jenis, sub } = extractJenisDanSub(query);
    const namaReq = extractNama(query);

    if (rows.length && namaReq) {
      const row = findRowByName(rows, namaReq);
      if (row) {
        const map: Record<string, number> = {
          // PKB
          "pkb.pokok": row.pkb_pokok,
          "pkb.denda": row.pkb_denda,
          "pkb.jumlah": row.pkb_jumlah,
          // BBNKB I
          "bbnkb1.pokok": row.bbnkb1_pokok,
          "bbnkb1.denda": row.bbnkb1_denda,
          "bbnkb1.jumlah": row.bbnkb1_jumlah,
          // BBNKB II
          "bbnkb2.pokok": row.bbnkb2_pokok,
          "bbnkb2.denda": row.bbnkb2_denda,
          "bbnkb2.jumlah": row.bbnkb2_jumlah,
          // SWDKLLJ (anggap satu kolom jumlah)
          "swdkllj.jumlah": row.swdkllj,
        };
        const key = jenis === "swdkllj" ? "swdkllj.jumlah" : `${jenis}.${sub}`;
        if (key in map) {
          const val = map[key];
          const labelJenis =
            jenis === "bbnkb1" ? "BBNKB I" :
            jenis === "bbnkb2" ? "BBNKB II" :
            jenis === "swdkllj" ? "SWDKLLJ" : "PKB";
          const labelSub =
            jenis === "swdkllj" ? "" : ` ${sub.toUpperCase()}`;
          const answerDet = `${labelJenis}${labelSub} untuk ${row.nama} = ${rupiah(val)}.`;
          return NextResponse.json({ answer: answerDet, sources: [] });
        }
      }
    }

    // === 2) FALLBACK KE LLM (untuk parafrase/pertanyaan bebas)
    const sysPrompt =
      `Anda asisten RAG untuk tabel pajak daerah.
ATURAN KERAS:
- Jika pengguna menyebut PKB/BBNKB I/BBNKB II/SWDKLLJ, jawab HANYA dari kolom tersebut.
- Jika menyebut "pokok/denda/jumlah", ambil sub-kolom tepatnya.
- Jika data tidak ada di konteks, jawab: "Tidak ditemukan di dokumen." Tanpa spekulasi.
- Format angka dalam Rupiah (id-ID). Jawaban singkat dan tepat.
=== KONTEN KONTEKS MULAI ===
${limitedContext}
=== KONTEN KONTEKS SELESAI ===`;

    const userMsg = query;

    // Try OpenRouter
    if (openrouterKey) {
      try {
        const resp = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
            "X-Title": "RAG Document AI",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userMsg },
            ],
            temperature: 0.1,
          }),
        });

        const data = await resp.json();
        if (resp.ok) {
          const answer = data?.choices?.[0]?.message?.content || "Tidak ditemukan di dokumen.";
          return NextResponse.json({ answer, sources: [] });
        }
      } catch {
        // lanjut ke Groq
      }
    }

    // Fallback Groq
    if (groqKey) {
      try {
        const resp = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userMsg },
            ],
            temperature: 0.1,
          }),
        });

        const data = await resp.json();
        if (resp.ok) {
          const answer = data?.choices?.[0]?.message?.content || "Tidak ditemukan di dokumen.";
          return NextResponse.json({ answer, sources: [] });
        }
        const msg = data?.error?.message || `Groq error (${resp.status})`;
        return NextResponse.json({ error: msg }, { status: 500 });
      } catch (e: any) {
        return NextResponse.json({ error: `Groq error: ${e.message}` }, { status: 500 });
      }
    }

    // Jika tidak ada API key, kembalikan jawaban default
    return NextResponse.json({ 
      answer: "Tidak ditemukan di dokumen.", 
      sources: [] 
    });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memproses query." }, { status: 500 });
  }
}