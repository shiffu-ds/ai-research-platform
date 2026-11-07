#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

FAILED=0

# In a Git checkout, check what Git tracks. In an exported copy (zip,
# tarball) there is no index, so check every file on disk instead and
# evaluate ignore rules in a throwaway repository seeded with .gitignore.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    IN_GIT=1
    TRACKED_FILES="$(git ls-files)"
else
    IN_GIT=0
    echo "NOTE: not a Git checkout; scanning files on disk instead of tracked files."
    TRACKED_FILES="$(
        find . -type f \
            -not -path "./.git/*" \
            -not -path "*/node_modules/*" \
            -not -path "*/.next/*" \
            -not -path "*/.venv/*" \
            -not -path "*/venv/*" \
            -not -path "*/__pycache__/*" \
            | sed 's#^\./##'
    )"
    IGNORE_SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$IGNORE_SANDBOX"' EXIT
    git -C "$IGNORE_SANDBOX" init -q
    cp .gitignore "$IGNORE_SANDBOX/.gitignore"
fi

echo "Running M5 repository security checks..."
echo

check_tracked() {
    local description="$1"
    local pattern="$2"

    matches="$(printf '%s\n' "$TRACKED_FILES" | grep -E "$pattern" || true)"

    if [[ -n "$matches" ]]; then
        echo "ERROR: $description"
        printf '%s\n' "$matches"
        echo
        FAILED=1
    else
        echo "OK: $description"
    fi
}

check_ignored() {
    local path="$1"
    local ignored=1

    if [[ "$IN_GIT" -eq 1 ]]; then
        git check-ignore -q "$path" || ignored=0
    else
        git -C "$IGNORE_SANDBOX" check-ignore -q --no-index "$path" || ignored=0
    fi

    if [[ "$ignored" -eq 1 ]]; then
        echo "OK: ignored -> $path"
    else
        echo "ERROR: expected Git to ignore -> $path"
        FAILED=1
    fi
}

echo "Checking tracked sensitive files..."

check_tracked \
    "No .env files are tracked" \
    '(^|/)\.env$'

check_tracked \
    "No Terraform state files are tracked" \
    '\.tfstate($|\.)'

check_tracked \
    "No Terraform variable files are tracked" \
    '\.tfvars(\.json)?$'

check_tracked \
    "No PostgreSQL backup SQL files are tracked" \
    '^backups/.*\.sql$'

check_tracked \
    "No private-key style files are tracked" \
    '\.(key|p12|pfx)$'

echo
echo "Checking required ignore rules..."

check_ignored ".env"
check_ignored "infrastructure/terraform/terraform.tfstate"
check_ignored "infrastructure/terraform/secrets.auto.tfvars"
check_ignored "backups/example.sql"

echo
echo "Checking environment templates..."

./scripts/check-environment-config.sh

echo

if [[ "$FAILED" -ne 0 ]]; then
    echo "Repository security validation FAILED."
    exit 1
fi

echo "Repository security validation PASSED."
