#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed."
  echo "Install it first (macOS): brew install ngrok/ngrok/ngrok"
  exit 1
fi

if ! curl -s "http://127.0.0.1:${PORT}" >/dev/null; then
  echo "No local app detected on port ${PORT}."
  echo "Start the app first: npm run dev"
  exit 1
fi

echo "Starting ngrok tunnel to http://localhost:${PORT}"
echo "Open ngrok inspector at http://127.0.0.1:4040"
ngrok http "${PORT}"
