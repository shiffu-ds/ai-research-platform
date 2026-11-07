#!/usr/bin/env bash

set -euo pipefail

SBOM_FILE="${1:-sbom.cdx.json}"

echo "============================================"
echo " M5 Dependency Vulnerability Scan"
echo "============================================"
echo

if ! command -v grype >/dev/null 2>&1; then
    echo "ERROR: Grype is not installed."
    exit 1
fi

if [[ ! -f "${SBOM_FILE}" ]]; then
    echo "ERROR: SBOM file not found: ${SBOM_FILE}"
    echo "Run ./scripts/generate-sbom.sh first."
    exit 1
fi

echo "Scanning:"
echo "${SBOM_FILE}"
echo

grype "sbom:${SBOM_FILE}"

echo
echo "============================================"
echo " Vulnerability scan completed."
echo "============================================"
