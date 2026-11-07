#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

echo "============================================"
echo " M5 Pre-Release Smoke Tests"
echo "============================================"
echo

echo "[1/7] Repository security validation..."
./scripts/check-repository-security.sh
echo

echo "[2/7] Docker Compose validation..."
docker compose config >/dev/null
echo "Docker Compose configuration is valid."
echo

echo "[3/7] Terraform validation..."

terraform -chdir=infrastructure/terraform fmt -check

terraform -chdir=infrastructure/terraform init \
  -backend=false \
  -input=false \
  >/dev/null

terraform -chdir=infrastructure/terraform validate

PLAN_FILE="$(mktemp)"

cleanup() {
    rm -f "$PLAN_FILE"
}

trap cleanup EXIT

terraform -chdir=infrastructure/terraform plan \
  -input=false \
  -lock=false \
  -var="environment=development" \
  -out="$PLAN_FILE" \
  >/dev/null

echo "Terraform development plan succeeded."
echo

echo "[4/7] Infrastructure health validation..."
./scripts/check-local-stack.sh
echo

echo "[5/7] PostgreSQL restore safety validation..."
./scripts/check-postgres-restore-safety.sh
echo

echo "[6/7] Alerting pipeline validation..."
./scripts/check-alert-pipeline.sh
echo

echo "[7/7] PostgreSQL disaster-recovery validation..."
./scripts/verify-postgres-recovery.sh
echo

echo "============================================"
echo " M5 PRE-RELEASE SMOKE TESTS PASSED"
echo "============================================"
