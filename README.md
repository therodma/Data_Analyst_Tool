# Automated Data Cleaning Tool

🌐 **Live App**: https://therodma.github.io/Data_Cleaning_Tool/

A full-stack web app to upload messy CSV/Excel datasets, detect data quality issues, apply cleaning transformations, and download the cleaned result.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, pandas, numpy, scipy, thefuzz
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Axios

---

## Quick Start

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API available at: http://localhost:8000  
Swagger docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at: http://localhost:3000

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload CSV or XLSX file |
| POST | `/analyze` | Analyze uploaded file for issues |
| POST | `/clean` | Apply selected transformations |
| GET | `/download/{session_id}` | Download cleaned CSV |

### Request/Response Schema
All responses follow: `{ success: bool, data: any, errors: string[] | null }`

### POST /upload
- Body: `multipart/form-data` with `file` field
- Returns: `session_id`, `shape`, `columns`, `preview` (first 10 rows)

### POST /analyze
- Body: `{ "session_id": "..." }`
- Returns: per-column analysis (missing, outliers, skewness, categories), duplicate count

### POST /clean
- Body: `{ "session_id": "...", "options": { ... } }`
- Options:
  - `fill_missing` (bool)
  - `drop_duplicates` (bool)
  - `handle_outliers` (bool)
  - `outlier_action` ("clip" | "remove")
  - `standardize_categories` (bool)
  - `log_transform` (bool)
- Returns: cleaning report, before/after stats, download URL

---

## Features

### Analysis Engine (`cleaner/analyzer.py`)
- Missing values: count, %, flags columns >20% missing
- Duplicates: exact row count
- Outliers: IQR method (1.5× IQR), per numeric column
- Category variants: fuzzy matching (≥85% similarity) for low-cardinality string columns
- Skewness: flags |skew| > 1

### Cleaning Engine (`cleaner/transformer.py`)
- Fill missing: median (numeric), mode (categorical)
- Drop exact duplicates
- Clip or remove outliers
- Standardize categories: lowercase + strip + most-common-variant wins
- Log1p transform for skewed columns

---

## Project Structure

```
data-cleaner/
├── backend/
│   ├── main.py              # FastAPI app + endpoints
│   ├── cleaner/
│   │   ├── analyzer.py      # Issue detection
│   │   └── transformer.py   # Cleaning transformations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadZone.tsx       # Step 1: drag-and-drop upload
│   │   │   ├── IssuesSummary.tsx    # Step 2: preview + issue cards
│   │   │   ├── TransformToggles.tsx # Step 3: cleaning options
│   │   │   └── ResultsPanel.tsx     # Step 4: results + download
│   │   ├── App.tsx          # Main app + state management
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```
