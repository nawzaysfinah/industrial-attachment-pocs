# Industrial Attachment POCs

`Industrial Attachment POCs` is a local desktop-style web app that helps you turn messy SME field notes into a structured AI POC recommendation report.

It is built for internship/industrial attachment use: you interview or observe a company, capture their pain points, and the tool helps you produce a consultant-style report with realistic, buildable POC ideas.

## In plain English: what this tool does

You give the app:

- basic company information
- pain points and priorities
- tools/data the company already uses
- optional files (PDF/DOCX/TXT notes)
- optional website links for context

The app then:

- extracts and stores all that information locally
- uses a local AI model (Ollama) to generate a detailed markdown report
- scores feasibility (can this be built in 6-8 weeks by a student?)
- suggests only 1-2 high-value POCs in depth
- cites web sources when claims come from online research

## Why this exists

Most internship AI proposals fail because they are too big, too vague, or disconnected from real operational pain.

This app is designed to enforce practical thinking:

- narrow scope
- check data reality
- stress-test feasibility
- produce a pitch that is credible to SME owners

It explicitly frames proposals as:
`POC built in-school first to de-risk`

## Local-first privacy model

This project is intentionally local-first:

- no cloud LLM API keys are required
- generation and embeddings run via local Ollama models
- case records are saved in local SQLite
- uploaded files stay on your machine (`./data/uploads`)

Optional web research is fetched directly from URLs you provide, then cached locally to reduce repeated calls.

## Who this is for

- students doing industrial attachment / internship projects
- lecturers/supervisors guiding practical AI adoption
- solo consultants scoping lightweight SME AI pilots

## Main screens

- `/` Dashboard
  - list all cases
  - start a new case
  - run cross-case search (GraphRAG)
- `/cases/new` Wizard
  - guided 7-step intake (not one giant form)
- `/cases/[id]` Case detail
  - review all inputs and sources
  - regenerate report or pitch
  - export markdown for Notion
  - mark POCs as validated

## What the generated report contains

Each report includes:

1. Executive Summary
2. Industry Deconstruction
3. AI Opportunity Map (ranked)
4. POC Design (top 1-2 only)
5. Feasibility Stress Test
6. Internship Conversion Plan
7. Collaboration Strategy
8. Sources

Feasibility is scored numerically across capability, data, risk, timeline, demo potential, and extension potential.  
If the score is too low, the recommendation is automatically narrowed/redesigned.

## Quick start (first-time setup)

1. Install Node dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env
```

3. Start Ollama (in a separate terminal):

```bash
ollama serve
```

4. Pull required local models:

```bash
ollama pull qwen3:latest
ollama pull nomic-embed-text:latest
```

5. Initialize local database:

```bash
npm run db:migrate
```

6. Start the app:

```bash
npm run dev
```

7. Open:

`http://localhost:3000`

## How to use (end-to-end)

1. Click `+ New Case`.
2. Complete all wizard steps:
   - company profile
   - pains and priorities
   - observations + uploads
   - optional web links
3. Click `Generate`.
4. Review the report and feasibility gate results.
5. Copy markdown or export `.md` into Notion.
6. Use dashboard search to compare patterns across past cases.

## Cross-case intelligence (GraphRAG)

As cases are saved, the app builds:

- graph nodes (company, pain points, tools, POCs)
- graph edges (relationships between those entities)
- vector embeddings for text chunks

When you search, it:

1. embeds your query
2. finds similar chunks
3. expands related graph entities
4. generates a structured cross-case answer

This helps answer questions like:

`Show me similar pains from other SMEs and what POCs we proposed`

## Tech stack (for developers)

- Next.js App Router + TypeScript + Tailwind CSS
- SQLite (`better-sqlite3`)
- Ollama (chat + embeddings)
- Zod schema validation
- `pdf-parse`, `mammoth` for file text extraction
- `@mozilla/readability` + `jsdom` + `cheerio` for web extraction

## Useful scripts

- `npm run dev` - start local dev server
- `npm run build` - production build check
- `npm run lint` - lint checks
- `npm run db:migrate` - apply SQLite migrations
- `npm run db:reset` - reset DB and re-run migrations

## Troubleshooting

- `Ollama not reachable`:
  - make sure `ollama serve` is running
  - check `.env` `OLLAMA_HOST` value
- `Model not found`:
  - run `ollama pull qwen3:latest`
  - run `ollama pull nomic-embed-text:latest`
- `No report output`:
  - check Ollama terminal logs
  - ensure at least one clear pain point is filled in wizard step 4

## Project status

This is a practical POC builder focused on speed, realism, and explainability over “perfect AI magic.”  
It is meant to help you propose de-risked, internship-ready AI pilots that can become real collaborations.
