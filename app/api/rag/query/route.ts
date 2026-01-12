// app/api/rag/query/route.ts
import { NextResponse } from "next/server";
import { parseTableFromText, findRowByName, findSubtotalPKB, findSubtotalBBNKB, findTotalGabungan } from "@/lib/parse-yogyakarta-pajak";

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

  // Deteksi apakah user meminta jumlah/total (berbeda dengan kolom jumlah)
  const memintaJumlah = /(total|jumlah|seluruh|kumulatif|sum|semua)/.test(q) && !/\bdenda\b/.test(q) && !/\bpokok\b/.test(q);
  const memintaDenda = /\bdenda\b/.test(q);
  const memintaPokok = /\bpokok\b/.test(q);

  // Prioritaskan: denda > pokok > jumlah
  const sub = memintaDenda ? "denda" :
               memintaPokok ? "pokok" :
               memintaJumlah ? "jumlah" : "jumlah"; // default ke jumlah jika tidak spesifik

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
    const { query, context, metadata } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Query kosong." }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // Deteksi query tentang jumlah dokumen (harus spesifik tentang dokumen/file, bukan data dalam dokumen)
    const q = normalize(query);
    const queryLower = query.toLowerCase();
    const isQueryDocumentCount = /(berapa|berapa\s+banyak|jumlah|total|ada\s+berapa)\s+(dokumen|file|document)/i.test(queryLower) || 
                                 /(dokumen|file|document)\s+(berapa|berapa\s+banyak|jumlah|total|ada)/i.test(queryLower) ||
                                 /(berapa|berapa\s+banyak)\s+(dokumen|file|document)\s+(yang|sudah|telah)/i.test(queryLower);

    // Jika query tentang jumlah dokumen, kembalikan jawaban deterministik
    if (isQueryDocumentCount && metadata) {
      const { documentCount, totalDocuments } = metadata;
      // Gunakan totalDocuments (jumlah dokumen yang benar-benar ada di state) sebagai sumber kebenaran
      const actualCount = totalDocuments !== undefined ? totalDocuments : (documentCount || 0);
      if (actualCount === 0) {
        return NextResponse.json({ 
          answer: "Belum ada dokumen yang diproses. Silakan upload dokumen terlebih dahulu.", 
          sources: [] 
        });
      } else if (actualCount === 1) {
        return NextResponse.json({ 
          answer: `Terdapat 1 dokumen yang sudah diproses.`, 
          sources: [] 
        });
      } else {
        return NextResponse.json({ 
          answer: `Terdapat ${actualCount} dokumen yang sudah diproses.`, 
          sources: [] 
        });
      }
    }

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

    // Deteksi query tentang total/subtotal
    const isQueryTotalPKB = /total\s*penerimaan\s*pkb/i.test(q) && !/bbnkb|bbn-kb/i.test(q);
    const isQueryTotalBBNKB = /total\s*penerimaan\s*bbnkb|total\s*penerimaan\s*bbn-kb/i.test(q);
    const isQueryTotalGabungan = /total\s*penerimaan\s*pkb\s*bbnkb|total\s*penerimaan\s*pkb\s*bbn-kb|total\s*penerimaan\s*(pkb\s*)?(dan\s*)?bbnkb/i.test(q);

    // Handle query tentang subtotal/total
    if (isQueryTotalPKB && !isQueryTotalGabungan) {
      // Query tentang SUB TOTAL PKB saja (bukan gabungan)
      const subtotalPKB = findSubtotalPKB(rows);
      if (subtotalPKB && subtotalPKB.pkb_jumlah > 0) {
        return NextResponse.json({ 
          answer: `Total Penerimaan PKB: ${rupiah(subtotalPKB.pkb_jumlah)}.`, 
          sources: [] 
        });
      }
    } else if (isQueryTotalBBNKB) {
      // Query tentang SUB TOTAL BBNKB
      const subtotalBBNKB = findSubtotalBBNKB(rows);
      if (subtotalBBNKB && subtotalBBNKB.bbnkb1_jumlah > 0) {
        return NextResponse.json({ 
          answer: `Total Penerimaan BBNKB: ${rupiah(subtotalBBNKB.bbnkb1_jumlah)}.`, 
          sources: [] 
        });
      }
    } else if (isQueryTotalGabungan) {
      // Query tentang TOTAL PENERIMAAN PKB BBNK-KB (gabungan)
      const totalGabungan = findTotalGabungan(rows);
      if (totalGabungan) {
        // Coba ambil dari baris total gabungan, atau hitung dari subtotal
        const subtotalPKB = findSubtotalPKB(rows);
        const subtotalBBNKB = findSubtotalBBNKB(rows);
        if (subtotalPKB && subtotalBBNKB) {
          const total = subtotalPKB.pkb_jumlah + subtotalBBNKB.bbnkb1_jumlah;
          return NextResponse.json({ 
            answer: `Total Penerimaan PKB BBNK-KB (A+B): ${rupiah(total)}.`, 
            sources: [] 
          });
        }
      }
    }

    // Handle query dengan nama kasir/kppd
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
- Jika pengguna menanyakan suatu kolom spesifik (pokok/denda/jumlah), jawab HANYA nilai dari kolom tersebut. JANGAN menjumlahkan atau menggabungkan dengan kolom lain.
- Jika pengguna menanyakan "denda", berikan nilai denda saja. JANGAN menjumlahkan dengan pokok.
- Jika pengguna menanyakan "pokok", berikan nilai pokok saja.
- Jika pengguna menanyakan "jumlah" atau meminta TOTAL, barulah berikan jumlah (pokok + denda).
- PENTING: Bedakan antara "SUB TOTAL PKB" dan "TOTAL PENERIMAAN PKB BBNK-KB":
  * "SUB TOTAL PKB" atau "Total Penerimaan PKB" (tanpa menyebut BBNKB) = hanya total PKB saja (biasanya sekitar 334.549.300)
  * "TOTAL PENERIMAAN PKB BBNK-KB" atau "Total Penerimaan PKB dan BBNKB" = gabungan PKB + BBNKB (biasanya sekitar 509.011.800)
  * Jika user bertanya "total penerimaan PKB" tanpa menyebut BBNKB, gunakan SUB TOTAL PKB, BUKAN total gabungan.
- JANGAN melakukan perhitungan tambahan atau interpretasi sendiri.
- Jika pengguna menyebut PKB/BBNKB I/BBNKB II/SWDKLLJ, ambil dari kolom tersebut saja.
- Format angka dalam Rupiah (id-ID). Jawaban singkat, tepat, dan sesuai permintaan pengguna.
- Jika data tidak ada di konteks, jawab: "Tidak ditemukan di dokumen." Tanpa spekulasi.
=== KONTEN KONTEKS MULAI ===
${limitedContext}
=== KONTEN KONTEKS SELESAI ===`;

    const userMsg = query;

    // Try OpenRouter dengan timeout
    if (openrouterKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 detik timeout

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
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await resp.json();
        if (resp.ok) {
          const answer = data?.choices?.[0]?.message?.content || "Tidak ditemukan di dokumen.";
          return NextResponse.json({ answer, sources: [] });
        }
      } catch (e) {
        console.log("OpenRouter timeout/error, fallback ke Groq:", e.message);
        // lanjut ke Groq
      }
    }

    // Fallback Groq
    if (groqKey) {
      console.log("Menggunakan Groq API...");
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
        
        // Check for rate limit error
        const errorMsg = data?.error?.message || "";
        if (errorMsg.includes("rate limit") || errorMsg.includes("Rate limit")) {
          console.log("Groq rate limit hit, returning helpful message");
          return NextResponse.json({ 
            answer: "Maaf, sistem sedang sibuk. Silakan coba lagi dalam beberapa detik. (Rate limit Groq tercapai)",
            sources: [] 
          });
        }
        
        const msg = errorMsg || `Groq error (${resp.status})`;
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