# Troubleshooting

## 1) Port 3000 already in use

Symptoms:
- `next dev` starts on a different port (e.g. 3001)
- UI opens on unexpected port

Fix:

```bash
# find process using 3000
lsof -i :3000

# stop it (replace PID)
kill <PID>

# restart app
npm run dev
```

## 2) Runtime module errors from `.next` artifacts

Symptoms:
- `Cannot find module './331.js'`
- `ENOENT ... .next/...manifest.json`
- blank screen or frequent `500` in dev

Cause:
- Dev/build artifact corruption (often from mixed build/dev states).

Fix:

```bash
pkill -f "next dev"
rm -rf .next .next-dev
npm run dev
```

Notes:
- This project separates dev/prod outputs (`.next-dev` for dev, `.next` for build) to reduce collisions.

## 3) `Unexpected token '<'` when calling APIs

Symptoms:
- JSON parse error in browser console
- looks like `Unexpected token '<', "<!DOCTYPE"...`

Cause:
- client expected JSON but received HTML error page from a failed endpoint.

Fix:
1. Check terminal logs for the failing API route.
2. Resolve underlying server error.
3. Refresh browser and retry.

This project now throws clearer errors in client API wrapper when non-JSON is returned.

## 4) OpenAI-backed answers not appearing

Symptoms:
- answers are generic/fallback
- embeddings seem inactive

Checks:
1. Ensure `.env` exists and `OPENAI_API_KEY` is set.
2. Restart dev server after env changes.
3. Verify optional model names are valid.

Recommended baseline:

```env
OPENAI_API_KEY=sk-...
ANSWER_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
```

## 5) Reset local app state

If you want a clean local state:

```bash
rm -rf data repos-cache .next .next-dev
npm run dev
```

What gets reset:
- `data/` — conversation history and audits (SQLite)
- `repos-cache/` — cloned GitHub repos
- `.next*` — build artifacts only

## 6) Playwright E2E issues

If browser binaries are missing:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

