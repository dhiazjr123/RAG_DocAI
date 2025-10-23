# scripts/docling_service.py

import io
import json
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse

app = FastAPI(title="Docling Extractor Service")

try:
    from docling import DocumentConverter
    DOC_AVAILABLE = True
    converter = DocumentConverter()
except Exception as e:
    DOC_AVAILABLE = False
    DOC_ERROR = str(e)


def try_export_tables(doc) -> List[dict]:
    out: List[dict] = []
    try:
        tables = getattr(doc, 'tables', []) or []
        for idx, table in enumerate(tables):
            item = {"index": idx}
            # Try markdown-like
            try:
                item["markdown"] = str(table)
            except Exception:
                pass
            # Try pandas
            try:
                if hasattr(table, 'export_to_dataframe'):
                    df = table.export_to_dataframe(doc=doc)
                    item["data"] = df.to_dict('records')
            except Exception:
                pass
            out.append(item)
    except Exception:
        pass
    return out


def try_export_images(doc) -> List[dict]:
    out: List[dict] = []
    try:
        pictures = getattr(doc, 'pictures', []) or []
        for idx, pic in enumerate(pictures):
            out.append({
                "index": idx,
                "description": getattr(pic, 'description', ''),
                "alt_text": getattr(pic, 'alt_text', ''),
                "width": getattr(pic, 'width', 0),
                "height": getattr(pic, 'height', 0),
            })
    except Exception:
        pass
    return out


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not DOC_AVAILABLE:
        return JSONResponse({
            "success": False,
            "error": f"Docling unavailable: {DOC_ERROR}",
        }, status_code=500)

    try:
        content = await file.read()
        doc = converter.convert(io.BytesIO(content))

        # Text as markdown if possible
        try:
            text = doc.export_to_markdown()
        except Exception:
            try:
                text = doc.to_text()
            except Exception:
                text = ""

        tables = try_export_tables(doc)
        images = try_export_images(doc)

        # Heuristic: extract numbered-row lines to help chunking
        row_lines: List[str] = []
        for line in (text or "").splitlines():
            l = line.strip()
            if l and (l[0].isdigit() and (l.split(".")[0].isdigit())):
                row_lines.append(l)

        return {
            "success": True,
            "raw_text": text,
            "row_lines": row_lines,
            "tables": tables,
            "images": images,
        }
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e),
        }, status_code=500)
