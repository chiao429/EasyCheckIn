#!/usr/bin/env bash
set -euo pipefail

environment="${1:-preview}"

case "$environment" in
  preview|production) ;;
  *)
    echo "Usage: $0 [preview|production]" >&2
    exit 2
    ;;
esac

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

vercel pull \
  --yes \
  --environment="$environment" \
  --token="$VERCEL_TOKEN"

if [[ "$environment" == "production" ]]; then
  vercel build --prod --token="$VERCEL_TOKEN"
  vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
else
  vercel build --token="$VERCEL_TOKEN"
  vercel deploy --prebuilt --token="$VERCEL_TOKEN"
fi
