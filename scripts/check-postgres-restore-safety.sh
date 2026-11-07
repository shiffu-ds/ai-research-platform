#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

echo "============================================"
echo " PostgreSQL Restore Safety Check"
echo "============================================"
echo

TEMP_BACKUP="$(mktemp)"

cleanup() {
    rm -f "$TEMP_BACKUP"
}

trap cleanup EXIT

printf '%s\n' '-- M5 restore safety test' > "$TEMP_BACKUP"

echo "Verifying that direct restore into the primary research database is blocked..."

set +e

OUTPUT="$(
  RESTORE_DB=research \
  ./scripts/restore-postgres.sh "$TEMP_BACKUP" 2>&1
)"

STATUS=$?

set -e

if [[ "$STATUS" -eq 0 ]]; then
    echo "ERROR: Restore safety guard did not block the operation."
    exit 1
fi

if ! grep -q \
  "Refusing to restore directly into the primary research database" \
  <<< "$OUTPUT"; then

    echo "ERROR: Restore failed, but not because of the expected safety guard."
    echo
    echo "$OUTPUT"
    exit 1
fi

echo "Primary database restore safety guard PASSED."
echo
echo "The restore script correctly refuses RESTORE_DB=research."
