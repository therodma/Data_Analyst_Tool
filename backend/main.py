import uuid
import os
import json
import shutil
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from cleaner import analyzer, transformer

app = FastAPI(title="Data Cleaner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("tmp_uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def ok(data: Any) -> dict:
    return {"success": True, "data": data, "errors": None}


def err(msg: str, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail={"success": False, "data": None, "errors": [msg]})


def _session_dir(session_id: str) -> Path:
    return UPLOAD_DIR / session_id


def _load_df(session_id: str, filename: str = "raw") -> pd.DataFrame:
    d = _session_dir(session_id)
    for ext in (".csv", ".xlsx"):
        p = d / f"{filename}{ext}"
        if p.exists():
            return pd.read_csv(p) if ext == ".csv" else pd.read_excel(p)
    raise err(f"File not found for session {session_id}", 404)


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if file.content_type not in (
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    ):
        # Also allow by extension
        if not (file.filename or "").endswith((".csv", ".xlsx")):
            raise err("Only CSV and XLSX files are supported.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise err("File exceeds 50 MB limit.")

    session_id = str(uuid.uuid4())
    session_dir = _session_dir(session_id)
    session_dir.mkdir(parents=True)

    ext = ".xlsx" if (file.filename or "").endswith(".xlsx") else ".csv"
    raw_path = session_dir / f"raw{ext}"
    raw_path.write_bytes(content)

    try:
        df = pd.read_csv(raw_path) if ext == ".csv" else pd.read_excel(raw_path)
    except Exception as e:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise err(f"Could not parse file: {e}")

    preview = df.head(10).fillna("").astype(str).to_dict(orient="records")
    columns = list(df.columns)

    return ok({
        "session_id": session_id,
        "filename": file.filename,
        "shape": {"rows": df.shape[0], "cols": df.shape[1]},
        "columns": columns,
        "preview": preview,
    })


@app.post("/analyze")
async def analyze_file(body: dict = Body(...)):
    session_id = body.get("session_id")
    if not session_id:
        raise err("session_id is required.")

    try:
        df = _load_df(session_id)
    except HTTPException:
        raise
    except Exception as e:
        raise err(str(e))

    try:
        report = analyzer.analyze(df)
    except Exception as e:
        raise err(f"Analysis failed: {e}", 500)

    # Persist analysis for later use
    analysis_path = _session_dir(session_id) / "analysis.json"
    analysis_path.write_text(json.dumps(report))

    return ok(report)


@app.post("/clean")
async def clean_file(body: dict = Body(...)):
    session_id = body.get("session_id")
    options = body.get("options", {})
    if not session_id:
        raise err("session_id is required.")

    try:
        df = _load_df(session_id)
    except HTTPException:
        raise
    except Exception as e:
        raise err(str(e))

    analysis_path = _session_dir(session_id) / "analysis.json"
    if not analysis_path.exists():
        raise err("Run /analyze before /clean.")
    analysis = json.loads(analysis_path.read_text())

    try:
        cleaned_df, report = transformer.clean(df, options, analysis)
    except Exception as e:
        raise err(f"Cleaning failed: {e}", 500)

    cleaned_path = _session_dir(session_id) / "cleaned.csv"
    cleaned_df.to_csv(cleaned_path, index=False)

    report_path = _session_dir(session_id) / "report.json"
    report_path.write_text(json.dumps(report))

    # Build before/after stats for diff table
    before_stats = _compute_stats(df)
    after_stats = _compute_stats(cleaned_df)

    return ok({
        "report": report,
        "before_stats": before_stats,
        "after_stats": after_stats,
        "download_url": f"/download/{session_id}",
    })


@app.get("/download/{session_id}")
async def download_cleaned(session_id: str):
    cleaned_path = _session_dir(session_id) / "cleaned.csv"
    if not cleaned_path.exists():
        raise err("Cleaned file not found. Run /clean first.", 404)
    return FileResponse(
        path=str(cleaned_path),
        media_type="text/csv",
        filename="cleaned_data.csv",
    )


def _compute_stats(df: pd.DataFrame) -> dict:
    stats: dict[str, Any] = {}
    for col in df.columns:
        s = df[col]
        entry: dict[str, Any] = {
            "missing": int(s.isna().sum()),
            "unique": int(s.nunique()),
        }
        if pd.api.types.is_numeric_dtype(s):
            entry["mean"] = round(float(s.mean()), 4) if not s.empty else None
            entry["std"] = round(float(s.std()), 4) if not s.empty else None
        stats[col] = entry
    return stats
