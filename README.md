# DataBoard

> AI-powered analytics dashboard generator — drop in a CSV, ask a business question, get a live visual dashboard in seconds.

**Live demo:** https://therodma.github.io/Data_Analyst_Tool/

---

## What it does

DataBoard takes your raw CSV or TSV data, sends it to Claude Sonnet (Anthropic), and instantly renders a fully interactive analytics dashboard — no backend, no database, no setup beyond an API key.

![DataBoard screenshot](https://placehold.co/900x500/6366f1/ffffff?text=DataBoard+Preview)

---

## Features

- **Drag-and-drop upload** — drop any `.csv` or `.tsv` file directly onto the page
- **Paste CSV** — skip the file entirely and paste raw data into the text area
- **Business questions** — guide the AI toward the insights that matter to you
- **AI-generated dashboard** — Claude Sonnet analyzes your data and returns a structured spec including:
  - 3–5 key metric summary cards
  - 2–4 Chart.js charts (bar, line, pie, doughnut) with axis labels derived from your actual column names
  - 3 key insight bullet points
- **Zero data retention** — your API key and data never leave your browser; there is no server

---

## Tech stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Charts | Chart.js + react-chartjs-2 |
| AI | Anthropic Claude Sonnet (direct browser API call) |
| Font | DM Sans (Google Fonts) |
| Hosting | GitHub Pages via GitHub Actions |

---

## Local development

```bash
git clone https://github.com/therodma/Data_Analyst_Tool.git
cd Data_Analyst_Tool
npm install
npm run dev
```

Open http://localhost:5173

---

## Deploy to GitHub Pages

This repo ships with a GitHub Actions workflow that builds and deploys automatically.

1. Push to GitHub
2. Go to **Settings → Pages → Source** and select **GitHub Actions**
3. Push any commit to `main` — the workflow handles the rest

Your live URL will be: `https://<your-username>.github.io/<your-repo>/`

---

## Usage

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Paste it into the API key field (never stored — session only)
3. Upload a CSV/TSV file or paste data directly
4. Optionally enter business questions, e.g.:
   - *"Which product category drives the most revenue?"*
   - *"What are the monthly growth trends?"*
5. Click **Generate Dashboard**

---

## Project structure

```
src/
└── App.jsx          # Entire application (upload, API call, dashboard render)
└── index.css        # Tailwind + DM Sans import
.github/
└── workflows/
    └── deploy.yml   # GitHub Pages auto-deploy
vite.config.js       # Vite + Tailwind plugin config
```

---

## License

MIT
