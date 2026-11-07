#!/usr/bin/env bash

set -euo pipefail

PROMETHEUS_URL="${PROMETHEUS_URL:-http://127.0.0.1:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://127.0.0.1:9093}"
ALERT_NAME="M5SyntheticAlertPipelineTest"

echo "============================================"
echo " M5 Alerting Pipeline Check"
echo "============================================"
echo

echo "[1/4] Checking loaded Prometheus alert rules..."

curl -fsS \
  "${PROMETHEUS_URL}/api/v1/rules" \
  | python3 -c '
import json
import sys

data = json.load(sys.stdin)

expected = {
    "MonitoringTargetDown",
    "PostgreSQLUnavailable",
    "RedisUnavailable",
}

found = set()

for group in data.get("data", {}).get("groups", []):
    for rule in group.get("rules", []):
        name = rule.get("name")
        if name:
            found.add(name)

missing = expected - found

if missing:
    print("ERROR: Missing Prometheus alert rules:")
    for name in sorted(missing):
        print(f"  - {name}")
    sys.exit(1)

for name in sorted(expected):
    print(f"OK: {name}")
'

echo
echo "[2/4] Checking Prometheus -> Alertmanager connection..."

ACTIVE_ALERTMANAGERS="$(
  curl -fsS \
    "${PROMETHEUS_URL}/api/v1/alertmanagers" \
    | python3 -c '
import json
import sys

data = json.load(sys.stdin)
print(len(data.get("data", {}).get("activeAlertmanagers", [])))
'
)"

if [[ "$ACTIVE_ALERTMANAGERS" -lt 1 ]]; then
    echo "ERROR: Prometheus has no active Alertmanager."
    exit 1
fi

echo "Prometheus has ${ACTIVE_ALERTMANAGERS} active Alertmanager connection(s)."

echo
echo "[3/4] Sending synthetic alert to Alertmanager..."

ACTIVE_PAYLOAD="$(
  python3 - <<PY
import json
from datetime import datetime, timedelta, timezone

now = datetime.now(timezone.utc)

payload = [
    {
        "labels": {
            "alertname": "${ALERT_NAME}",
            "severity": "info",
            "component": "m5-qa"
        },
        "annotations": {
            "summary": "Synthetic M5 alert pipeline test"
        },
        "startsAt": now.isoformat(),
        "endsAt": (now + timedelta(minutes=5)).isoformat()
    }
]

print(json.dumps(payload))
PY
)"

curl -fsS \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$ACTIVE_PAYLOAD" \
  "${ALERTMANAGER_URL}/api/v2/alerts" \
  >/dev/null

sleep 2

curl -fsS \
  "${ALERTMANAGER_URL}/api/v2/alerts" \
  | python3 -c '
import json
import sys

alerts = json.load(sys.stdin)

expected = "M5SyntheticAlertPipelineTest"

for alert in alerts:
    labels = alert.get("labels", {})
    if labels.get("alertname") == expected:
        print("Synthetic alert found in Alertmanager.")
        sys.exit(0)

print("ERROR: Synthetic alert was not found in Alertmanager.")
sys.exit(1)
'

echo
echo "[4/4] Resolving synthetic alert..."

RESOLVED_PAYLOAD="$(
  python3 - <<PY
import json
from datetime import datetime, timedelta, timezone

now = datetime.now(timezone.utc)

payload = [
    {
        "labels": {
            "alertname": "${ALERT_NAME}",
            "severity": "info",
            "component": "m5-qa"
        },
        "annotations": {
            "summary": "Synthetic M5 alert pipeline test"
        },
        "startsAt": (now - timedelta(minutes=1)).isoformat(),
        "endsAt": now.isoformat()
    }
]

print(json.dumps(payload))
PY
)"

curl -fsS \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$RESOLVED_PAYLOAD" \
  "${ALERTMANAGER_URL}/api/v2/alerts" \
  >/dev/null

echo "Synthetic alert resolution submitted."

echo
echo "============================================"
echo " M5 ALERTING PIPELINE CHECK PASSED"
echo "============================================"
