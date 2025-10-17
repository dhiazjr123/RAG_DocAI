// app/api/rag/chat/route.ts
import { NextResponse } from "next/server";

const P = process.env;

export async function POST(req: Request) {
  const { messages, system } = await req.json();

  try {
    // Try OpenRouter first
    if (P.OPENROUTER_API_KEY) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${P.OPENROUTER_API_KEY}`,
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
            "X-Title": "RAG Document AI",
          },
          body: JSON.stringify({
            model: P.RAG_MODEL ?? P.OPENROUTER_MODEL ?? "openrouter/auto",
            messages: [
              ...(system ? [{ role: "system", content: system }] : []),
              ...messages, // [{role:'user'|'assistant', content:'...'}]
            ],
            temperature: 0.2,
          }),
        });
        const j = await r.json();
        if (r.ok) {
          return NextResponse.json({ text: j.choices?.[0]?.message?.content ?? "" });
        }
        // If OpenRouter fails, try Groq
      } catch (e) {
        // If OpenRouter fails, try Groq
      }
    }

    // Fallback to Groq
    if (P.GROQ_API_KEY) {
      try {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${P.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: P.GROQ_MODEL ?? "llama-3.1-8b-instant",
            messages: [
              ...(system ? [{ role: "system", content: system }] : []),
              ...messages,
            ],
            temperature: 0.2,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? "Groq chat failed");
        return NextResponse.json({ text: j.choices?.[0]?.message?.content ?? "" });
      } catch (e: any) {
        return NextResponse.json({ error: `Groq error: ${e.message}` }, { status: 500 });
      }
    }

    // Fallback ke Ollama lokal (jika OpenRouter dan Groq tidak ada)
    try {
      const r = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: P.OLLAMA_MODEL ?? "llama3.1",
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            ...messages,
          ],
          stream: false,
          options: { temperature: 0.2 },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "chat failed");
      return NextResponse.json({ text: j.message?.content ?? "" });
    } catch (ollamaErr: any) {
      return NextResponse.json(
        { error: "Chat backend tidak tersedia. Set OPENROUTER_API_KEY atau GROQ_API_KEY di .env, atau jalankan Ollama di http://localhost:11434" },
        { status: 500 }
      );
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message || "chat error" }, { status: 500 });
  }
}
