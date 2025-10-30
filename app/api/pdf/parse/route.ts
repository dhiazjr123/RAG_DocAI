// app/api/pdf/parse/route.ts
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseWithPdfplumber(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create temporary file
    const tempFile = path.join(os.tmpdir(), `pdf-${Date.now()}.pdf`);
    fs.writeFileSync(tempFile, buffer);

    // Normalize path untuk Windows (ganti backslash dengan forward slash)
    const normalizedPath = tempFile.replace(/\\/g, '/');

    // Run pdfplumber via Python
    const pythonScript = `
import pdfplumber
import sys

try:
    pdf = pdfplumber.open(r'${normalizedPath}')
    text = ""
    for page in pdf.pages:
        text += page.extract_text() or ""
        text += "\\n"
    print(text)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

    const pythonProcess = spawn("python", ["-c", pythonScript]);

    let output = "";
    let error = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      error += data.toString();
    });

    pythonProcess.on("close", (code) => {
      // Cleanup
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      if (code !== 0) {
        reject(new Error(error || "Pdfplumber parsing failed"));
      } else {
        resolve(output);
      }
    });
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseWithPdfplumber(buffer);

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Pdfplumber error:", error);
    return NextResponse.json({ error: error.message || "Gagal parse PDF" }, { status: 500 });
  }
}
