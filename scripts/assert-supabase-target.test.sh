#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
guard="scripts/assert-supabase-target"

"$guard" staging kihyogedhwvzmewceqjg >/dev/null
for ref in fdquwfmrpvemxqutyupn fdguwfmrpvemxqutyupn unknown-project-ref; do
  if "$guard" staging "$ref" >/dev/null 2>&1; then echo "expected blocked ref: $ref" >&2;exit 1;fi
done
if ASSERT_SUPABASE_NO_LINKED_REF=1 SUPABASE_PROJECT_REF="" "$guard" staging "" >/dev/null 2>&1; then echo "expected empty ref to fail" >&2;exit 1;fi
if "$guard" production kihyogedhwvzmewceqjg >/dev/null 2>&1; then echo "expected environment mismatch to fail" >&2;exit 1;fi
echo "6 target-guard checks passed"
