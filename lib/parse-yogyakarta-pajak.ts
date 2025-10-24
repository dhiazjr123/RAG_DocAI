// lib/parse-yogyakarta-pajak.ts

export type PajakRow = {
  no: number;
  nama: string;
  // PKB
  pkb_pokok: number;
  pkb_denda: number;
  pkb_jumlah: number;
  // BBNKB I
  bbnkb1_pokok: number;
  bbnkb1_denda: number;
  bbnkb1_jumlah: number;
  // BBNKB II
  bbnkb2_pokok: number;
  bbnkb2_denda: number;
  bbnkb2_jumlah: number;
  // SWDKLLJ (umumnya hanya jumlah)
  swdkllj: number;
};

function toNumberOrZero(s: string): number {
  const t = (s || "").replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(/,(\d+)$/, ".$1");
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

function normalizeName(s = ""): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Improved heuristic: parse table-like lines dengan deteksi yang lebih baik.
 * - Detect lines beginning with an index (e.g., "1.", "12.")
 * - Extract currency-like numbers (e.g., 1.234.567) in order
 * - Assign numbers to known columns by position
 * - The text between the leading index and the first number is treated as `nama`
 * - IMPROVEMENT: Better detection for denda and swdkllj
 */
export function parseTableFromText(text: string): PajakRow[] {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/);

  const out: PajakRow[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\u00A0/g, " ").trim();
    
    // IMPROVEMENT: Lebih fleksibel untuk deteksi baris data
    const m = line.match(/^(\d+)\s*\./);
    if (!m) {
      // Coba deteksi baris tanpa nomor tapi dengan nama dan angka
      if (line.match(/^[A-Z\s]+[0-9,\.]/) && line.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/)) {
        // Baris tanpa nomor, tambahkan nomor otomatis
        const numMatches = Array.from(line.matchAll(/(?:Rp\s*)?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g)).map((mm) => mm[0]);
        if (numMatches.length >= 4) {
          const firstNumIdx = line.search(/(?:Rp\s*)?\d{1,3}(?:\.\d{3})*(?:,\d+)?/);
          const nama = line.slice(0, firstNumIdx).replace(/\s+/g, " ").trim();
          
          const nums = numMatches.map(toNumberOrZero);
          const val = (idx: number) => (idx < nums.length ? nums[idx] : 0);
          
          const row: PajakRow = {
            no: out.length + 1,
            nama,
            pkb_pokok: val(0),
            pkb_denda: val(1),
            pkb_jumlah: val(2),
            bbnkb1_pokok: val(3),
            bbnkb1_denda: val(4),
            bbnkb1_jumlah: val(5),
            bbnkb2_pokok: val(6),
            bbnkb2_denda: val(7),
            bbnkb2_jumlah: val(8),
            swdkllj: val(9),
          };
          
          out.push(row);
        }
      }
      continue;
    }

    const no = parseInt(m[1], 10);
    // Split into [prefix (nama + maybe codes)] and numbers
    // Grab all currency-like numbers in order
    const numMatches = Array.from(line.matchAll(/(?:Rp\s*)?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g)).map((mm) => mm[0]);
    if (numMatches.length < 4) {
      // too short to be a data row
      continue;
    }

    // Nama is substring from after the numbering up to the first number
    const firstNumIdx = line.search(/(?:Rp\s*)?\d{1,3}(?:\.\d{3})*(?:,\d+)?/);
    const afterNoIdx = line.indexOf(".") + 1;
    const nama = line.slice(afterNoIdx, firstNumIdx).replace(/\s+/g, " ").trim();

    // By observation order (most common in the docs):
    // [PKB pokok, PKB denda, PKB jumlah, BBNKB1 pokok, BBNKB1 denda, BBNKB1 jumlah,
    //  BBNKB2 pokok, BBNKB2 denda, BBNKB2 jumlah, SWDKLLJ jumlah]
    // Some rows may have fewer BBNKB2 columns; fill missing with 0
    const nums = numMatches.map(toNumberOrZero);

    const val = (idx: number) => (idx < nums.length ? nums[idx] : 0);

    const row: PajakRow = {
      no,
      nama,
      pkb_pokok: val(0),
      pkb_denda: val(1),
      pkb_jumlah: val(2),
      bbnkb1_pokok: val(3),
      bbnkb1_denda: val(4),
      bbnkb1_jumlah: val(5),
      bbnkb2_pokok: val(6),
      bbnkb2_denda: val(7),
      bbnkb2_jumlah: val(8),
      swdkllj: val(9),
    };

    out.push(row);
  }

  return out;
}

export function findRowByName(rows: PajakRow[], nameQuery: string): PajakRow | undefined {
  const q = normalizeName(nameQuery);
  if (!q) return undefined;

  // exact contains
  let best = rows.find((r) => normalizeName(r.nama).includes(q));
  if (best) return best;

  // fuzzy: split tokens
  const tokens = q.split(" ").filter(Boolean);
  if (!tokens.length) return undefined;

  return rows.find((r) => {
    const rn = normalizeName(r.nama);
    return tokens.every((t) => rn.includes(t));
  });
}
  