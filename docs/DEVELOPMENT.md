# Development Guide

## Local Development Workflow

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env
```

Set at least:

```env
OPENAI_API_KEY=sk-...
```

3. Start dev server

```bash
npm run dev
```

4. Run tests before committing

```bash
npm run test
npm run quality:gate
```

## Commands

- `npm run dev` — start local app at `http://localhost:3000`
- `npm run build` — production build
- `npm run start` — run built app
- `npm run test` — vitest suite
- `npm run test:e2e` — Playwright E2E
- `npm run quality:gate` — trust-specific test gate

## Project Module Map

### App/UI
- `src/app/` — app entry, API routes, global styles
- `src/components/` — UI components
- `src/components/chat/` — chat-focused presentation modules

### API & Services
- `src/app/api/*` — HTTP handlers
- `src/lib/services/answerQuestionService.ts` — ask-flow orchestration
- `src/lib/api/response.ts` — response envelope/error helpers

### Retrieval/Reasoning
- `src/lib/repo/` — clone/refresh GitHub repo locally
- `src/lib/index/` — chunking + indexing status manager
- `src/lib/retrieval/` — retrieval strategy and cache
- `src/lib/investigator/` — answer generation pipeline
- `src/lib/audit/` — citation verification + independent audit
- `src/lib/memory/` — claim ledger + contradiction/lineage logic

### Persistence and Telemetry
- `src/lib/db/` — SQLite access and schema
- `src/lib/telemetry/` — structured logs + in-memory metrics
- `src/lib/types/` — shared TypeScript contracts

## CI Expectations

Current CI workflow (`.github/workflows/ci.yml`) runs:

1. `npm ci`
2. `npm run test`
3. `npm run quality:gate`
4. `npm run build`
5. E2E smoke (`npm run test:e2e` with Playwright Chromium)

Treat CI green as merge minimum.

## Refactor Conventions

- Keep route handlers thin; move orchestration into `src/lib/services/`.
- Prefer shared contracts from `src/lib/types/` to avoid duplicate interfaces.
- Keep non-trivial logic testable in `src/lib/*` modules.
- Preserve API envelope format (`apiVersion`, `requestId`, `data|error`).

