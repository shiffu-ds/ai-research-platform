#!/usr/bin/env bash

set -euo pipefail

echo "============================================"
echo " M5 Container Image Security Scan"
echo "============================================"
echo

IMAGES=(
  "postgres:16-alpine"
  "redis:7-alpine"
)

for IMAGE in "${IMAGES[@]}"; do
    echo
    echo "--------------------------------------------"
    echo "Scanning: ${IMAGE}"
    echo "--------------------------------------------"

    trivy image \
      --scanners vuln \
      --severity HIGH,CRITICAL \
      "${IMAGE}"
done

echo
echo "============================================"
echo " Container image scans completed."
echo "============================================"
