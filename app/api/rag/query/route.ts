// app/api/rag/query/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto"; // boleh diganti
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

export async function POST(req: Request) {
  try {
    const { query, context } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Query kosong." }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    
    // Debug log
    console.log('Debug - OpenRouter Key:', openrouterKey ? 'SET' : 'NOT SET');
    console.log('Debug - Groq Key:', groqKey ? 'SET' : 'NOT SET');

    // Limit context size to avoid token limit (rough estimate: 1 token ≈ 4 chars)
    const MAX_CONTEXT_CHARS = 20000; // ~5000 tokens, leaving room for query + system prompt
    let limitedContext = context || "(no context)";
    if (limitedContext.length > MAX_CONTEXT_CHARS) {
      limitedContext = limitedContext.substring(0, MAX_CONTEXT_CHARS) + "\n\n[... context truncated ...]";
    }

    // Get current time info
    const now = new Date();
    const timeInfo = {
      date: now.toLocaleDateString('id-ID', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      greeting: now.getHours() < 12 ? 'pagi' : 
                now.getHours() < 15 ? 'siang' : 
                now.getHours() < 18 ? 'sore' : 'malam'
    };

    const sysPrompt = [
      "Anda adalah asisten RAG yang netral dan sangat teliti.",
      "Jawab HANYA berdasarkan data eksplisit dalam konteks; jangan mengira-ngira.",
      "",
      "ATURAN DISAMBIGUASI NILAI:",
      "1) Jika ditanya 'pokok' (misal: 'PKB pokok'), JANGAN pakai 'jumlah' atau 'total' yang termasuk denda. Ambil nilai pada baris/kolom berlabel 'pokok' saja.",
      "2) Jika ditanya 'denda', JANGAN pakai pokok ataupun jumlah. Ambil nilai pada baris/kolom berlabel 'denda'.",
      "3) Jika ditanya 'jumlah' atau 'total', barulah gunakan 'jumlah' (pokok + denda) jika memang begitu labelnya.",
      "4) Jika pertanyaan menyebut lokasi/kasir tertentu (misal 'kasir samsat sewon'), batasi pencarian pada bagian yang menyebut lokasi/kasir tersebut.",
      "5) Jika ada beberapa baris, pilih yang paling spesifik konteksnya (PKB vs pajak lain, lokasi yang disebut, periode/nota yang cocok).",
      "6) Jika ragu atau label tidak ada, katakan tidak pasti dan tampilkan 1-3 kandidat baris terkait untuk diverifikasi user.",
      "",
      "FORMAT JAWABAN:",
      "- Berikan nominal dengan format 'Rp X.XXX.XXX' yang persis seperti di dokumen.",
      "- Sebutkan label yang dipakai (pokok/denda/jumlah) dan lokasi/kasir jika relevan.",
      "- Kutip 1 baris sumber paling relevan dari konteks (tanpa menambah/mengubah angka).",
      "",
      "CONTOH PENANGANAN KASUS:",
      "Q: 'denda di PKB dari kasir samsat sewon berapa' → Cari baris yang mengandung 'PKB' AND 'denda' AND 'samsat sewon'. Jawab hanya nilai denda.",
      "Q: 'pokok PKB samsat sewon' → Cari label 'pokok' (bukan jumlah).",
      "",
      `INFO WAKTU SAAT INI:`,
      `- Tanggal: ${timeInfo.date}`,
      `- Jam: ${timeInfo.time}`,
      `- Salam yang tepat: Selamat ${timeInfo.greeting}`,
      "",
      "=== KONTEN KONTEXT ===",
      limitedContext,
      "=======================",
    ].join("\n");

    // Try OpenRouter first
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
              { role: "user", content: query },
            ],
            temperature: 0.1,
          }),
        });

        const data = await resp.json();
        if (resp.ok) {
          const answer = data?.choices?.[0]?.message?.content || "Saya tidak tahu.";
          return NextResponse.json({ answer, sources: [] });
        }
        // If OpenRouter fails, try Groq
      } catch (e) {
        // If OpenRouter fails, try Groq
      }
    }

    // Fallback to Groq
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
              { role: "user", content: query },
            ],
            temperature: 0.1,
          }),
        });

        const data = await resp.json();
        if (resp.ok) {
          const answer = data?.choices?.[0]?.message?.content || "Saya tidak tahu.";
          return NextResponse.json({ answer, sources: [] });
        }
        const msg = data?.error?.message || `Groq error (${resp.status})`;
        return NextResponse.json({ error: msg }, { status: 500 });
      } catch (e: any) {
        return NextResponse.json({ error: `Groq error: ${e.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      error: "OPENROUTER_API_KEY atau GROQ_API_KEY harus diset di .env.local" 
    }, { status: 500 });
  } catch (e: any) {
    console.error("QUERY ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Gagal memproses query." },
      { status: 500 }
    );
  }
}