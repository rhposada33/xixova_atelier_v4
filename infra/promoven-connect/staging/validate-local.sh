#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$repo"
: "${CONNECT_SUPABASE_CLI:?Provide path to an installed Supabase CLI; no automatic CLI install}"
"$CONNECT_SUPABASE_CLI" test db --workdir "$repo/infra/promoven-connect"
npm --prefix infra/promoven-connect/worker test
npm --prefix infra/promoven-connect/privacy-worker test
npm --prefix infra/promoven-connect/mail-worker test
node infra/promoven-connect/mail-worker/real-integration.mjs
node --test infra/promoven-connect/ops/*.test.mjs infra/promoven-connect/proxy/proxy.test.mjs
node infra/promoven-connect/proxy/real-integration.mjs
npm --prefix packages/connect-contracts test
npm --prefix packages/connect-contracts run typecheck
npm --prefix apps/promoven-connect-web run build
npm --prefix apps/promoven-connect-web run lint
npm --prefix apps/promoven-connect-web run test:unit
(
 cd apps/promoven-connect-web
 set -a
 source .env.e2e.local
 set +a
 npm run test:e2e
 node tests/link-concurrency.mjs
 node tests/crm-concurrency.mjs
 node tests/media-quota-concurrency.mjs
)
# Recovery is deliberately last, after every writer has finished.
CONNECT_PRIVACY_RECOVERY=1 infra/promoven-connect/ops/recovery-local.sh
git diff --check
# This command is expected to block a release while readiness gates are false.
node infra/promoven-connect/staging/check-release.mjs
