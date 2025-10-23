// lib/doclingExtractor.js
// Node.js wrapper untuk Docling Python extractor

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Ekstrak dokumen menggunakan Docling Python script
 * @param {string} filePath - Path ke file dokumen
 * @returns {Promise<Object>} Hasil ekstraksi
 */
async function extractWithDocling(filePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'docling_extractor.py');
    
    // Cek apakah Python script ada
    fs.access(scriptPath)
      .then(() => {
        // Jalankan Python script
        const pythonProcess = spawn('python', [scriptPath, filePath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          } else {
            reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          }
        });
        
        pythonProcess.on('error', (error) => {
          reject(new Error(`Failed to start Python process: ${error.message}`));
        });
      })
      .catch(() => {
        // Fallback: coba dengan python3
        const python3Process = spawn('python3', [scriptPath, filePath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        python3Process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        python3Process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        python3Process.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          } else {
            reject(new Error(`Python3 script failed with code ${code}: ${stderr}`));
          }
        });
        
        python3Process.on('error', (error) => {
          reject(new Error(`Python3 not available: ${error.message}`));
        });
      });
  });
}

/**
 * Fallback ekstraksi menggunakan library Node.js yang ada
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Nama file
 * @param {string} mimeType - MIME type
 * @returns {Promise<Object>} Hasil ekstraksi fallback
 */
async function fallbackExtraction(buffer, filename, mimeType) {
  try {
    // Gunakan pdf-parse untuk PDF
    if (mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf')) {
      const pdfParse = await import('pdf-parse');
      const data = await pdfParse.default(buffer);
      
      return {
        success: true,
        text: data.text,
        tables: [],
        images: [],
        metadata: {
          title: data.info?.Title || '',
          author: data.info?.Author || '',
          pages: data.numpages || 0
        }
      };
    }
    
    // Gunakan mammoth untuk DOCX
    if (mimeType.includes('document') || filename.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer });
      
      return {
        success: true,
        text: value,
        tables: [],
        images: [],
        metadata: {
          title: '',
          author: '',
          pages: 0
        }
      };
    }
    
    // Fallback untuk file text
    return {
      success: true,
      text: buffer.toString('utf8'),
      tables: [],
      images: [],
      metadata: {
        title: '',
        author: '',
        pages: 0
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      text: '',
      tables: [],
      images: [],
      metadata: {}
    };
  }
}

/**
 * Ekstrak dokumen dengan Docling atau fallback
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Nama file
 * @param {string} mimeType - MIME type
 * @returns {Promise<Object>} Hasil ekstraksi
 */
async function extractDocument(buffer, filename, mimeType) {
  try {
    // Coba ekstrak dengan Docling terlebih dahulu
    const tempFilePath = path.join(process.cwd(), 'temp', `temp_${Date.now()}_${filename}`);
    
    // Pastikan direktori temp ada
    await fs.mkdir(path.dirname(tempFilePath), { recursive: true });
    
    // Tulis buffer ke file sementara
    await fs.writeFile(tempFilePath, buffer);
    
    try {
      const result = await extractWithDocling(tempFilePath);
      
      // Hapus file sementara
      await fs.unlink(tempFilePath).catch(() => {});
      
      if (result.success) {
        return result;
      } else {
        console.log('Docling failed, using fallback:', result.error);
        return await fallbackExtraction(buffer, filename, mimeType);
      }
    } catch (doclingError) {
      console.log('Docling not available, using fallback:', doclingError.message);
      
      // Hapus file sementara
      await fs.unlink(tempFilePath).catch(() => {});
      
      return await fallbackExtraction(buffer, filename, mimeType);
    }
    
  } catch (error) {
    console.error('Document extraction error:', error);
    return await fallbackExtraction(buffer, filename, mimeType);
  }
}

module.exports = {
  extractDocument,
  extractWithDocling,
  fallbackExtraction
};
