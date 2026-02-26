# Industrial Attachment POCs

## What Is This Project?

**Industrial Attachment POCs** is a local AI-powered tool that helps turn real company problems into structured, realistic AI Proof of Concepts (POCs) that can then become meaningful internships for students.

In simple terms:

> It helps me talk to companies, understand their real operational problems, and design practical AI solutions that students can build safely and realistically.

Instead of sending students into companies blindly, this tool allows us to:

1. Understand the company properly.
2. Identify where AI can genuinely help.
3. Build a small prototype in school first.
4. Deploy students only after the idea is validated.

This reduces risk for companies and improves the quality of internships for students.

## Why This Exists

Many SMEs (small and medium-sized enterprises):

- have messy workflows
- use Excel as a database
- handle repetitive tasks manually
- struggle with documentation and knowledge management
- are curious about AI but do not know where to start

At the same time, students:

- can code in Python
- can clean and analyse data
- can build dashboards and simple AI tools
- cannot safely build large, mission-critical systems on their own

This tool bridges that gap.

It helps match:

- real business problems
- with realistic student capabilities
- in a structured, low-risk way

## What The App Does

The app works like a guided consultant.

You enter:

- industry type
- company description
- pain points
- tools they use
- observations from site visits
- ethnographic notes (documents, PDFs, etc.)
- optional online research links

The system then:

1. Breaks down the company’s operations.
2. Identifies realistic AI opportunities.
3. Designs 1-2 practical POCs.
4. Stress-tests whether students can actually build them.
5. Generates a structured report.
6. Suggests how this becomes an internship role.
7. Produces a pitch message for the company.

All of this runs locally using Ollama as the AI engine.

No external LLM APIs are required.

## The Core Philosophy

### 1. Build in School First

Every POC is designed to be:

- prototyped during curriculum time
- demonstrated in a 5-minute showcase
- validated by the company
- only then extended during internship

This de-risks the collaboration.

The company sees something real before committing to hosting interns.

### 2. Be Pragmatic, Not Flashy

This tool does not suggest:

- overly complex AI systems
- infrastructure-heavy deployments
- unrealistic “AI transformation” ideas

Instead, it focuses on:

- workflow automation
- data cleaning and dashboarding
- simple ML models
- knowledge assistants
- process improvements

Things SMEs actually care about.

### 3. Every POC Must Be Feasible

Each proposed solution is scored on:

- student capability fit
- data availability
- risk level
- time to MVP
- demo-ability
- internship extension potential

If it does not pass the feasibility gate, it gets redesigned or rejected.

## GraphRAG and Case Memory

The system stores each company as a case record.

Over time, it builds:

- a knowledge graph of industries, pain points, tools, and POCs
- a searchable archive of past collaborations
- cross-case insights (for example: “What problems do logistics SMEs usually have?”)

This allows smarter recommendations over time.

The more cases entered, the stronger the system becomes.

## Who This Is For

This tool is built for:

- Industrial Attachment Coordinators
- AI lecturers
- educators designing industry-linked projects
- anyone building structured SME-AI collaborations

Currently, it is designed for single-user use and runs locally.

## What This Is Not

This is not:

- a general chatbot
- a business plan generator
- a full enterprise AI consulting platform
- a student project idea randomizer

It is a **structured AI collaboration engine** designed specifically to convert SME pain points into validated, student-buildable AI projects.

## Long-Term Vision

Over time, this system helps:

- standardise how AI POCs are designed for SMEs
- improve internship quality
- build long-term industry partnerships
- position the institution as an AI experimentation lab
- create repeatable, scalable collaboration models

Instead of finding internships reactively, this creates them strategically.

## Technical Overview (High-Level)

- Built with Next.js (local web app)
- Uses Ollama for local AI generation and embeddings
- Stores case data in SQLite
- Supports document uploads and web research
- Implements GraphRAG for cross-case intelligence
- Outputs structured reports in Markdown

## How To Run This App Locally

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env
```

3. Start Ollama in a separate terminal:

```bash
ollama serve
```

4. Pull required models:

```bash
ollama pull qwen3:latest
ollama pull nomic-embed-text:latest
```

5. Initialize SQLite:

```bash
npm run db:migrate
```

6. Start the app:

```bash
npm run dev
```

7. Open:

`http://localhost:3000`

## Basic Usage Flow

1. Go to `+ New Case`.
2. Fill in company details and pain points.
3. Upload notes and optional web links.
4. Generate the report.
5. Review feasibility gate results.
6. Export markdown to Notion and share with company stakeholders.

## Final Summary

Industrial Attachment POCs is a practical AI consulting assistant that:

- understands SMEs
- designs realistic AI experiments
- protects companies from risk
- protects students from overreach
- turns prototypes into internships
- builds long-term collaboration pipelines

It is not about hype.

It is about structured, repeatable, real-world AI adoption: starting small and growing sustainably.
