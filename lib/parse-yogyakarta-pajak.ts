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
  // Flag untuk baris subtotal/total
  isSubtotal?: boolean;
  isTotal?: boolean;
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
    
    // Deteksi baris SUB TOTAL atau TOTAL (tanpa nomor)
    const lineLower = normalizeName(line);
    const isSubtotalPKB = /sub\s*total\s*pkb/i.test(line) && !/bbnkb|bbn-kb/i.test(line);
    const isSubtotalBBNKB = /sub\s*total\s*bbnkb|sub\s*total\s*bbn-kb/i.test(line);
    const isSubtotalSWDKLLJ = /sub\s*total\s*swdkllj/i.test(line);
    const isSubtotalPNBP = /sub\s*total\s*pnbp/i.test(line);
    const isTotalGabungan = /total\s*penerimaan\s*pkb\s*bbnkb|total\s*penerimaan\s*pkb\s*bbn-kb/i.test(line);
    const isJumlahHariIni = /jumlah\s+hari\s+ini/i.test(lineLower);
    const isGrandTotal = /grand\s+total/i.test(lineLower);
    
    // Deteksi format baris dengan ":" (seperti "SUB TOTAL PKB (A) : 334.549.300")
    const colonMatch = line.match(/^(.+?)\s*:\s*([\d.,\s]+)/i);
    if (colonMatch) {
      const label = colonMatch[1].trim();
      // Ambil hanya angka pertama setelah ":" (sebelum spasi atau angka kecil yang mungkin jumlah WP)
      // Format biasanya: "LABEL : 334.549.300 348" dimana 348 adalah jumlah WP
      const valuePart = colonMatch[2].trim();
      // Ambil hanya bagian pertama (angka besar dengan titik pemisah ribuan, berhenti sebelum angka kecil)
      // Format: "334.549.300 348" dimana 348 adalah jumlah WP yang harus diabaikan
      // Split by space dan ambil hanya bagian pertama (angka dengan format ribuan)
      const parts = valuePart.split(/\s+/);
      const firstPart = parts[0] || valuePart;
      // Pastikan firstPart adalah angka dengan format ribuan (dengan titik sebagai pemisah ribuan)
      // Format: 1-3 digit, lalu titik, lalu 3 digit berulang
      if (firstPart.match(/^\d{1,3}(?:\.\d{3})*(?:,\d+)?$/)) {
        const valueStr = firstPart.replace(/\./g, "").replace(/,(\d+)$/, ".$1");
        const value = parseFloat(valueStr) || 0;
        
        const labelLower = normalizeName(label);
      if (isSubtotalPKB || /sub\s*total\s*pkb/i.test(labelLower)) {
        const row: PajakRow = {
          no: out.length + 1,
          nama: label,
          pkb_pokok: 0,
          pkb_denda: 0,
          pkb_jumlah: value,
          bbnkb1_pokok: 0,
          bbnkb1_denda: 0,
          bbnkb1_jumlah: 0,
          bbnkb2_pokok: 0,
          bbnkb2_denda: 0,
          bbnkb2_jumlah: 0,
          swdkllj: 0,
          isSubtotal: true,
          isTotal: false,
        };
        out.push(row);
        continue;
      } else if (isSubtotalBBNKB || /sub\s*total\s*bbnkb|sub\s*total\s*bbn-kb/i.test(labelLower)) {
        const row: PajakRow = {
          no: out.length + 1,
          nama: label,
          pkb_pokok: 0,
          pkb_denda: 0,
          pkb_jumlah: 0,
          bbnkb1_pokok: 0,
          bbnkb1_denda: 0,
          bbnkb1_jumlah: value,
          bbnkb2_pokok: 0,
          bbnkb2_denda: 0,
          bbnkb2_jumlah: 0,
          swdkllj: 0,
          isSubtotal: true,
          isTotal: false,
        };
        out.push(row);
        continue;
      } else if (isSubtotalSWDKLLJ || /sub\s*total\s*swdkllj/i.test(labelLower)) {
        const row: PajakRow = {
          no: out.length + 1,
          nama: label,
          pkb_pokok: 0,
          pkb_denda: 0,
          pkb_jumlah: 0,
          bbnkb1_pokok: 0,
          bbnkb1_denda: 0,
          bbnkb1_jumlah: 0,
          bbnkb2_pokok: 0,
          bbnkb2_denda: 0,
          bbnkb2_jumlah: 0,
          swdkllj: value,
          isSubtotal: true,
          isTotal: false,
        };
        out.push(row);
        continue;
      } else if (isTotalGabungan || /total\s+penerimaan\s*pkb\s*bbnkb|total\s+penerimaan\s*pkb\s*bbn-kb/i.test(labelLower)) {
        // Untuk total gabungan, kita perlu split antara PKB dan BBNKB
        // Tapi karena formatnya gabungan, kita simpan di kedua field
        const row: PajakRow = {
          no: out.length + 1,
          nama: label,
          pkb_pokok: 0,
          pkb_denda: 0,
          pkb_jumlah: 0, // Akan diisi dari subtotal PKB jika ada
          bbnkb1_pokok: 0,
          bbnkb1_denda: 0,
          bbnkb1_jumlah: 0, // Akan diisi dari subtotal BBNKB jika ada
          bbnkb2_pokok: 0,
          bbnkb2_denda: 0,
          bbnkb2_jumlah: 0,
          swdkllj: 0,
          isSubtotal: false,
          isTotal: true,
        };
        out.push(row);
        continue;
      } else if (isGrandTotal || /grand\s+total/i.test(labelLower)) {
        // Untuk GRAND TOTAL, simpan nilai di swdkllj field sebagai placeholder
        // karena struktur PajakRow tidak memiliki field khusus untuk GRAND TOTAL
        const row: PajakRow = {
          no: out.length + 1,
          nama: label,
          pkb_pokok: 0,
          pkb_denda: 0,
          pkb_jumlah: value, // Simpan GRAND TOTAL di pkb_jumlah sebagai placeholder
          bbnkb1_pokok: 0,
          bbnkb1_denda: 0,
          bbnkb1_jumlah: 0,
          bbnkb2_pokok: 0,
          bbnkb2_denda: 0,
          bbnkb2_jumlah: 0,
          swdkllj: 0,
          isSubtotal: false,
          isTotal: true,
        };
        out.push(row);
        continue;
      } else if (isSubtotalPNBP || /sub\s*total\s*pnbp/i.test(labelLower)) {
        // Untuk PNBP, simpan nilai di swdkllj field sebagai placeholder
        // karena struktur PajakRow tidak memiliki field khusus untuk PNBP
        const row: PajakRow = {
          no: out.length + 1,
          nama: label,
          pkb_pokok: 0,
          pkb_denda: 0,
          pkb_jumlah: 0,
          bbnkb1_pokok: 0,
          bbnkb1_denda: 0,
          bbnkb1_jumlah: 0,
          bbnkb2_pokok: 0,
          bbnkb2_denda: 0,
          bbnkb2_jumlah: 0,
          swdkllj: value, // Simpan PNBP di swdkllj field sebagai placeholder
          isSubtotal: true,
          isTotal: false,
        };
        out.push(row);
        continue;
      }
      }
    }
    
    // IMPROVEMENT: Lebih fleksibel untuk deteksi baris data
    const m = line.match(/^(\d+)\s*\./);
    if (!m) {
      // Coba deteksi baris subtotal/total tanpa nomor (termasuk "JUMLAH HARI INI")
      if (isSubtotalPKB || isSubtotalBBNKB || isSubtotalSWDKLLJ || isSubtotalPNBP || isTotalGabungan || isJumlahHariIni) {
        const numMatches = Array.from(line.matchAll(/(?:Rp\s*)?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g)).map((mm) => mm[0]);
        // Untuk "JUMLAH HARI INI", minimal harus ada 10 angka (semua kolom)
        const minMatches = isJumlahHariIni ? 10 : 2;
        if (numMatches.length >= minMatches) {
          const firstNumIdx = line.search(/(?:Rp\s*)?\d{1,3}(?:\.\d{3})*(?:,\d+)?/);
          const nama = line.slice(0, firstNumIdx).replace(/\s+/g, " ").trim();
          
          const nums = numMatches.map(toNumberOrZero);
          const val = (idx: number) => (idx < nums.length ? nums[idx] : 0);
          
          // Untuk subtotal, ambil angka pertama sebagai jumlah total
          // Untuk "JUMLAH HARI INI", parse semua kolom dengan urutan yang benar
          const row: PajakRow = {
            no: out.length + 1,
            nama,
            pkb_pokok: (isSubtotalPKB || isJumlahHariIni) ? val(0) : 0,
            pkb_denda: isJumlahHariIni ? val(1) : 0,
            pkb_jumlah: (isSubtotalPKB || isJumlahHariIni) ? (isJumlahHariIni ? val(2) : val(0)) : 0,
            bbnkb1_pokok: (isSubtotalBBNKB || isJumlahHariIni) ? (isJumlahHariIni ? val(3) : val(0)) : 0,
            bbnkb1_denda: isJumlahHariIni ? val(4) : 0,
            bbnkb1_jumlah: (isSubtotalBBNKB || isJumlahHariIni) ? (isJumlahHariIni ? val(5) : val(0)) : 0,
            bbnkb2_pokok: isJumlahHariIni ? val(6) : 0,
            bbnkb2_denda: isJumlahHariIni ? val(7) : 0,
            bbnkb2_jumlah: isJumlahHariIni ? val(8) : 0,
            swdkllj: (isSubtotalSWDKLLJ || isJumlahHariIni) ? (isJumlahHariIni ? val(9) : val(0)) : 0,
            isSubtotal: isSubtotalPKB || isSubtotalBBNKB || isSubtotalSWDKLLJ || isSubtotalPNBP,
            isTotal: isTotalGabungan || isJumlahHariIni,
          };
          
          out.push(row);
        }
      } else if (line.match(/^[A-Z\s]+[0-9,\.]/) && line.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/)) {
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

/**
 * Cari baris SUB TOTAL PKB (bukan total gabungan)
 */
export function findSubtotalPKB(rows: PajakRow[]): PajakRow | undefined {
  return rows.find((r) => {
    const nama = normalizeName(r.nama);
    return r.isSubtotal && /sub\s*total\s*pkb/i.test(nama) && !/bbnkb|bbn-kb/i.test(nama);
  });
}

/**
 * Cari baris SUB TOTAL BBNKB
 */
export function findSubtotalBBNKB(rows: PajakRow[]): PajakRow | undefined {
  return rows.find((r) => {
    const nama = normalizeName(r.nama);
    return r.isSubtotal && /sub\s*total\s*bbnkb|sub\s*total\s*bbn-kb/i.test(nama);
  });
}

/**
 * Cari baris TOTAL PENERIMAAN PKB BBNK-KB (gabungan)
 */
export function findTotalGabungan(rows: PajakRow[]): PajakRow | undefined {
  return rows.find((r) => {
    const nama = normalizeName(r.nama);
    return r.isTotal && /total\s*penerimaan\s*pkb\s*bbnkb|total\s*penerimaan\s*pkb\s*bbn-kb/i.test(nama);
  });
}

/**
 * Cari baris SUB TOTAL SWDKLLJ
 */
export function findSubtotalSWDKLLJ(rows: PajakRow[]): PajakRow | undefined {
  return rows.find((r) => {
    const nama = normalizeName(r.nama);
    return r.isSubtotal && /sub\s*total\s*swdkllj/i.test(nama);
  });
}

/**
 * Hitung total SWDKLLJ dari semua baris (jika tidak ada subtotal)
 */
export function calculateTotalSWDKLLJ(rows: PajakRow[]): number {
  // Cek dulu apakah ada subtotal
  const subtotal = findSubtotalSWDKLLJ(rows);
  if (subtotal && subtotal.swdkllj > 0) {
    return subtotal.swdkllj;
  }
  
  // Jika tidak ada subtotal, hitung dari semua baris (kecuali baris subtotal/total)
  return rows
    .filter(r => !r.isSubtotal && !r.isTotal)
    .reduce((sum, r) => sum + (r.swdkllj || 0), 0);
}
  