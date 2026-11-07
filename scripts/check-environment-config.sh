#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BASE_DIR="${REPO_ROOT}/infrastructure/environments"

environments=(
    "development"
    "staging"
    "production"
)

echo "Checking environment configuration templates..."
echo

for environment in "${environments[@]}"; do
    file="${BASE_DIR}/${environment}/environment.example"

    echo "Checking: infrastructure/environments/${environment}/environment.example"

    if [[ ! -f "$file" ]]; then
        echo "ERROR: Missing environment template:"
        echo "$file"
        exit 1
    fi

    expected="APP_ENV=${environment}"

    app_env_count="$(
        grep -c "^APP_ENV=" "$file" || true
    )"

    if [[ "$app_env_count" -ne 1 ]]; then
        echo "ERROR: Expected exactly one APP_ENV entry in:"
        echo "$file"
        echo "Found: $app_env_count"
        exit 1
    fi

    if ! grep -qx "$expected" "$file"; then
        echo "ERROR: Incorrect APP_ENV value in:"
        echo "$file"
        echo
        echo "Expected:"
        echo "$expected"
        exit 1
    fi

    if grep -nE \
        '^[[:space:]]*[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|API_KEY|ACCESS_KEY)[A-Z0-9_]*=.+$' \
        "$file" >/dev/null; then
        echo "ERROR: Possible secret value found in:"
        echo "$file"
        exit 1
    fi

    echo "OK"
    echo
done

echo "Environment configuration validation PASSED."
