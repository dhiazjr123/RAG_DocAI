// app/api/rag/query/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto"; // boleh diganti

export async function POST(req: Request) {
  try {
    const { query, context } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Query kosong." }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY belum diset di .env" },
        { status: 500 }
      );
    }

    const sysPrompt = [
      "Anda adalah asisten AI yang membantu dan informatif.",
      "Jika ada konteks dokumen yang relevan, gunakan untuk menjawab pertanyaan.",
      "Jika tidak ada konteks atau konteks tidak relevan, jawab pertanyaan umum berdasarkan pengetahuan Anda.",
      "Selalu berikan jawaban yang bermanfaat dan ramah.",
      "",
      "=== KONTEN KONTEXT ===",
      context || "(tidak ada dokumen yang di-upload)",
      "=======================",
    ].join("\n");

    const resp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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
        temperature: 0.2,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      // forward error OpenRouter biar terlihat jelas di UI
      const msg =
        data?.error?.message ||
        data?.message ||
        `OpenRouter error (${resp.status})`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const answer = data?.choices?.[0]?.message?.content || "Saya tidak tahu.";
    return NextResponse.json({ answer, sources: [] });
  } catch (e: any) {
    console.error("QUERY ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Gagal memproses query." },
      { status: 500 }
    );
  }
}
