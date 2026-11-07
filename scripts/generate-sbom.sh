#!/usr/bin/env bash

set -euo pipefail

OUTPUT_FILE="${1:-sbom.cdx.json}"

echo "============================================"
echo " M5 SBOM Generation"
echo "============================================"
echo

if ! command -v syft >/dev/null 2>&1; then
    echo "ERROR: Syft is not installed."
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: jq is not installed."
    exit 1
fi

echo "[1/3] Generating CycloneDX SBOM..."

syft dir:. \
  -o "cyclonedx-json=${OUTPUT_FILE}"

echo
echo "[2/3] Validating SBOM JSON..."

jq empty "${OUTPUT_FILE}"

echo "SBOM JSON is valid."

echo
echo "[3/3] Counting discovered components..."

COMPONENT_COUNT="$(jq '.components | length' "${OUTPUT_FILE}")"

echo "Components discovered: ${COMPONENT_COUNT}"

echo
echo "============================================"
echo " SBOM generated successfully."
echo " File: ${OUTPUT_FILE}"
echo "============================================"
