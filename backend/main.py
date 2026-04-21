import uuid
import json
import shutil
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from cleaner import analyzer, transformer

app = FastAPI(title="Data Cleaner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://therodma.github.io",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("tmp_uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 50 * 1024 * 1024


def ok(data: Any) -> dict:
    return {"success": True, "data": data, "errors": None}


def err(msg: str, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail={"success": False, "data": None, "errors": [msg]})


def _session_dir(session_id: str) -> Path:
    return UPLOAD_DIR / session_id


def _load_df(session_id: str) -> pd.DataFrame:
    d = _session_dir(session_id)
    for ext in (".csv", ".xlsx"):
        p = d / f"raw{ext}"
        if p.exists():
            return pd.read_csv(p) if ext == ".csv" else pd.read_excel(p)
    raise err(f"File not found for session {session_id}", 404)


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    description: UploadFile = File(None),
):
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

    # Save original filename for download naming
    (session_dir / "original_name.txt").write_text(file.filename or "data")

    # Save optional TXT description
    description_text = ""
    if description and (description.filename or "").endswith(".txt"):
        desc_content = await description.read()
        description_text = desc_content.decode("utf-8", errors="ignore")
        (session_dir / "description.txt").write_text(description_text)

    try:
        df = pd.read_csv(raw_path) if ext == ".csv" else pd.read_excel(raw_path)
    except Exception as e:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise err(f"Could not parse file: {e}")

    preview = df.head(10).fillna("").astype(str).to_dict(orient="records")

    return ok({
        "session_id": session_id,
        "filename": file.filename,
        "shape": {"rows": df.shape[0], "cols": df.shape[1]},
        "columns": list(df.columns),
        "preview": preview,
        "description": description_text,
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

    # Add histogram data for numeric columns
    hist_data: dict[str, list] = {}
    for col, info in report["columns"].items():
        if info.get("skewness") is not None:
            series = df[col].dropna()
            counts, bin_edges = np.histogram(series, bins=20)
            hist_data[col] = [
                {"bin": round(float(bin_edges[i]), 2), "count": int(counts[i])}
                for i in range(len(counts))
            ]
    report["histograms"] = hist_data

    analysis_path = _session_dir(session_id) / "analysis.json"
    analysis_path.write_text(json.dumps(report))

    return ok(report)


@app.post("/clean")
async def clean_file(body: dict = Body(...)):
    session_id = body.get("session_id")
    options = body.get("options", {})
    column_instructions = body.get("column_instructions", {})
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

    # Apply column-level instructions before standard cleaning
    df, instruction_log = _apply_column_instructions(df, column_instructions)

    try:
        cleaned_df, report = transformer.clean(df, options, analysis)
    except Exception as e:
        raise err(f"Cleaning failed: {e}", 500)

    report["instruction_log"] = instruction_log

    # Load description if exists
    desc_path = _session_dir(session_id) / "description.txt"
    report["description"] = desc_path.read_text() if desc_path.exists() else ""

    # Load original filename
    name_path = _session_dir(session_id) / "original_name.txt"
    original_name = name_path.read_text() if name_path.exists() else "data.csv"
    stem = Path(original_name).stem
    cleaned_filename = f"{stem}_CLEANED.csv"

    cleaned_path = _session_dir(session_id) / "cleaned.csv"
    cleaned_df.to_csv(cleaned_path, index=False)
    (session_dir / "cleaned_filename.txt").write_text(cleaned_filename) if (session_dir := _session_dir(session_id)) else None

    before_stats = _compute_stats(df)
    after_stats = _compute_stats(cleaned_df)

    # After-clean histogram data
    hist_data: dict[str, list] = {}
    for col in cleaned_df.columns:
        if pd.api.types.is_numeric_dtype(cleaned_df[col]):
            series = cleaned_df[col].dropna()
            if len(series) > 0:
                counts, bin_edges = np.histogram(series, bins=20)
                hist_data[col] = [
                    {"bin": round(float(bin_edges[i]), 2), "count": int(counts[i])}
                    for i in range(len(counts))
                ]

    return ok({
        "report": report,
        "before_stats": before_stats,
        "after_stats": after_stats,
        "after_histograms": hist_data,
        "download_url": f"/download/{session_id}",
        "cleaned_filename": cleaned_filename,
    })


@app.get("/download/{session_id}")
async def download_cleaned(session_id: str):
    session_dir = _session_dir(session_id)
    cleaned_path = session_dir / "cleaned.csv"
    if not cleaned_path.exists():
        raise err("Cleaned file not found. Run /clean first.", 404)

    name_path = session_dir / "original_name.txt"
    original_name = name_path.read_text() if name_path.exists() else "data.csv"
    stem = Path(original_name).stem
    cleaned_filename = f"{stem}_CLEANED.csv"

    return FileResponse(
        path=str(cleaned_path),
        media_type="text/csv",
        filename=cleaned_filename,
    )


def _apply_column_instructions(df: pd.DataFrame, instructions: dict) -> tuple[pd.DataFrame, list[str]]:
    df = df.copy()
    log: list[str] = []
    for col, action in instructions.items():
        if col not in df.columns:
            continue
        if action == "drop":
            df = df.drop(columns=[col])
            log.append(f"Dropped column '{col}'.")
        elif action == "categorical":
            df[col] = df[col].astype(str)
            log.append(f"Converted '{col}' to categorical (string).")
        elif action == "numeric":
            df[col] = pd.to_numeric(df[col], errors="coerce")
            log.append(f"Converted '{col}' to numeric.")
        elif action.startswith("cap:"):
            try:
                cap_val = float(action.split(":")[1])
                df[col] = df[col].clip(upper=cap_val)
                log.append(f"Capped '{col}' at {cap_val}.")
            except (ValueError, IndexError):
                pass
        elif action.startswith("floor:"):
            try:
                floor_val = float(action.split(":")[1])
                df[col] = df[col].clip(lower=floor_val)
                log.append(f"Floored '{col}' at {floor_val}.")
            except (ValueError, IndexError):
                pass
    return df, log


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
