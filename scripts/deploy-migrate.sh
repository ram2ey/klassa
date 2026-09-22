#!/usr/bin/env sh
set -eu

echo "[deploy] Applying database migrations..."
npm run db:migrate

echo "[deploy] Ensuring the initial platform administrator exists..."
npm run admin:bootstrap

echo "[deploy] Database preparation completed."
