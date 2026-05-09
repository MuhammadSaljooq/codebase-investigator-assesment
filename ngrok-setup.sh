#!/usr/bin/env bash
set -euo pipefail

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed."
  echo "Install it first (macOS): brew install ngrok/ngrok/ngrok"
  exit 1
fi

if [ "${1:-}" = "" ]; then
  echo "Usage: ./ngrok-setup.sh <NGROK_AUTHTOKEN>"
  echo "You can copy your token from https://dashboard.ngrok.com/get-started/your-authtoken"
  exit 1
fi

ngrok config add-authtoken "$1"
echo "ngrok authtoken saved."
echo "Next: npm run dev"
echo "Then: npm run ngrok:start"
