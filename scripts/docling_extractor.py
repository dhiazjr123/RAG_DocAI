#!/usr/bin/env python3
"""
Docling Document Extractor
Menggunakan Docling untuk mengekstrak dokumen dengan tabel, gambar, dan struktur kompleks
"""

import sys
import json
import argparse
from pathlib import Path

def extract_with_docling(file_path: str) -> dict:
    """
    Ekstrak dokumen menggunakan Docling
    """
    try:
        from docling import DocumentConverter
        from docling.datamodel.base_models import InputFormat
        
        # Inisialisasi converter
        converter = DocumentConverter()
        
        # Konversi dokumen
        doc = converter.convert(file_path)
        
        # Ekstrak data terstruktur
        result = {
            "success": True,
            "text": doc.export_to_markdown(),
            "tables": [],
            "images": [],
            "metadata": {
                "title": getattr(doc, 'title', ''),
                "author": getattr(doc, 'author', ''),
                "pages": len(doc.pages) if hasattr(doc, 'pages') else 0
            }
        }
        
        # Ekstrak tabel
        if hasattr(doc, 'tables'):
            for i, table in enumerate(doc.tables):
                try:
                    # Konversi tabel ke format yang bisa dibaca
                    table_data = {
                        "index": i,
                        "data": table.export_to_dataframe(doc=doc).to_dict('records') if hasattr(table, 'export_to_dataframe') else [],
                        "markdown": str(table) if hasattr(table, '__str__') else ""
                    }
                    result["tables"].append(table_data)
                except Exception as e:
                    print(f"Error processing table {i}: {e}", file=sys.stderr)
        
        # Ekstrak gambar (metadata saja, tidak menyimpan file)
        if hasattr(doc, 'pictures'):
            for i, pic in enumerate(doc.pictures):
                try:
                    image_data = {
                        "index": i,
                        "description": getattr(pic, 'description', ''),
                        "alt_text": getattr(pic, 'alt_text', ''),
                        "width": getattr(pic, 'width', 0),
                        "height": getattr(pic, 'height', 0)
                    }
                    result["images"].append(image_data)
                except Exception as e:
                    print(f"Error processing image {i}: {e}", file=sys.stderr)
        
        return result
        
    except ImportError:
        return {
            "success": False,
            "error": "Docling not installed. Please install with: pip install docling",
            "text": "",
            "tables": [],
            "images": [],
            "metadata": {}
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "text": "",
            "tables": [],
            "images": [],
            "metadata": {}
        }

def main():
    parser = argparse.ArgumentParser(description='Extract document using Docling')
    parser.add_argument('file_path', help='Path to the document file')
    parser.add_argument('--output', '-o', help='Output JSON file path')
    
    args = parser.parse_args()
    
    # Validasi file
    file_path = Path(args.file_path)
    if not file_path.exists():
        result = {
            "success": False,
            "error": f"File not found: {file_path}",
            "text": "",
            "tables": [],
            "images": [],
            "metadata": {}
        }
    else:
        result = extract_with_docling(str(file_path))
    
    # Output hasil
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
