# Industrial Attachment POCs

Local-first Next.js (App Router) application for generating structured SME POC consultancy reports using Ollama.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SQLite (`better-sqlite3`)
- Ollama for generation + embeddings
- Zod validation
- File extraction: `pdf-parse`, `mammoth`, plain text
- Web extraction: `fetch` + `@mozilla/readability` + `jsdom` fallback to `cheerio`
- GraphRAG: SQLite graph + vector chunks + cosine similarity in TS

## Features

- Step-by-step guided wizard at `/cases/new`
- File uploads for ethnographic notes (PDF, DOCX, TXT/MD) with extracted text previews
- Optional web research fetch + extraction + SQLite cache
- Case persistence to SQLite
- Consultant-style markdown report with:
  - Executive Summary
  - 6 required sections
  - Feasibility gate scoring with reject/redesign behavior
  - Required pitch phrase: `POC built in-school first to de-risk`
  - Source citations using `[source_<id>]`
- Case detail page with:
  - Regenerate full report (streaming)
  - Regenerate pitch-only
  - Export/copy markdown
  - Mark POCs as validated
- Dashboard cross-case search using GraphRAG

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Ensure Ollama is installed and running:

```bash
ollama serve
```

4. Pull required local models:

```bash
ollama pull qwen3:latest
ollama pull nomic-embed-text:latest
```

5. Run SQLite migrations:

```bash
npm run db:migrate
```

6. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run lint` - lint checks
- `npm run db:migrate` - apply SQLite migrations
- `npm run db:reset` - reset SQLite file and re-run migrations

## Notes

- Data is local by default under `./data/`.
- Uploaded files are persisted to `./data/uploads`.
- Ollama errors (not running/model missing) are surfaced through API responses.
