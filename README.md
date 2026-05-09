# Codebase Investigator

Local-first codebase investigator for public GitHub repositories.

Paste a repo URL, ask plain-English questions, and get:
- grounded answers with file/line citations,
- an independent audit per non-trivial answer,
- contradiction checks across conversation turns.

## What this project includes

- Next.js app router frontend + API routes
- local SQLite persistence (`data/investigator.sqlite`)
- local cloned repo cache (`repos-cache/`)
- lexical + embedding-assisted retrieval
- independent answer audit pipeline
- unit/regression tests + E2E smoke scaffold

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- git CLI installed
- OpenAI API key (for model-backed answers/audits)

## Quick Start (about 5 minutes)

1) Install dependencies

```bash
npm install
```

2) Create local env file

```bash
cp .env.example .env
```

3) Add your API key in `.env`

```bash
OPENAI_API_KEY=your_key_here
```

4) Run the app

```bash
npm run dev
```

5) Open

- [http://localhost:3000](http://localhost:3000)

## API Key and Environment Setup

All configurable environment variables are documented in `.env.example`.

Required:
- `OPENAI_API_KEY` — used for answer and embedding model calls.

Optional:
- `OPENAI_BASE_URL` — custom OpenAI-compatible endpoint.
- `ANSWER_MODEL` — chat model override (default: `gpt-4o-mini`).
- `AUDITOR_MODEL` — model override for independent auditor pass.
- `EMBEDDING_MODEL` — embedding model override (default: `text-embedding-3-small`).
- `LLM_TIMEOUT_MS` — timeout for model HTTP calls (default: `2000`).

Example `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
ANSWER_MODEL=gpt-4o-mini
AUDITOR_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
LLM_TIMEOUT_MS=3000
```

## Run and Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Unit + regression tests
npm run test

# Watch tests
npm run test:watch

# E2E tests
npm run test:e2e

# Trust quality gate
npm run quality:gate
```

## Core Workflow

1) Ingest repo (`/api/repo`)
2) Index + retrieve relevant chunks
3) Generate structured answer with citations
4) Run independent audit checks
5) Save turn + claims + audit history
6) Show results in chat UI

## API Quick Reference

All API responses use a versioned envelope:

```json
{
  "apiVersion": "v1",
  "requestId": "uuid",
  "data": { "...": "..." }
}
```

Errors:

```json
{
  "apiVersion": "v1",
  "requestId": "uuid",
  "error": {
    "code": "ANSWER_FAILED",
    "message": "..."
  }
}
```

### Ingest repository

```bash
curl -X POST http://localhost:3000/api/repo \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl":"https://github.com/vercel/next.js",
    "title":"Next.js Investigation"
  }'
```

### Ask question

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": 1,
    "question": "How does auth work and what would you change?"
  }'
```

### Get history

```bash
curl http://localhost:3000/api/history/1
```

For formal API schema, see:
- [`docs/openapi.yaml`](docs/openapi.yaml)

## Storage and Local Artifacts

- SQLite DB: `data/investigator.sqlite`
- Cloned repos: `repos-cache/`
- Next dev build output: `.next-dev/`
- Next production build output: `.next/`

## Troubleshooting and Developer Guides

- Developer workflow: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
- Runtime/setup troubleshooting: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)

