#!/usr/bin/env bash

set -euo pipefail

echo "============================================"
echo " Autonomous AI Research Platform"
echo " M5 Local Infrastructure Health Check"
echo "============================================"
echo

echo "[1/10] Checking Docker Compose services..."
docker compose ps
echo

echo "[2/10] Checking PostgreSQL..."

docker compose exec -T postgres \
  pg_isready \
  -U "${POSTGRES_USER:-research}" \
  -d "${POSTGRES_DB:-research}"

echo
echo "[3/10] Checking Redis..."

REDIS_RESPONSE="$(docker compose exec -T redis redis-cli ping | tr -d '\r')"

if [[ "$REDIS_RESPONSE" != "PONG" ]]; then
    echo "ERROR: Redis did not return PONG."
    exit 1
fi

echo "Redis returned PONG."
echo

echo "[4/10] Checking Prometheus..."

curl -fsS http://127.0.0.1:9090/-/healthy
echo

PROMETHEUS_UP="$(
  curl -fsS \
    'http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22prometheus%22%7D' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["result"][0]["value"][1])'
)"

GRAFANA_UP="$(
  curl -fsS \
    'http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22grafana%22%7D' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["result"][0]["value"][1])'
)"
POSTGRES_EXPORTER_UP="$(
  curl -fsS \
    'http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22postgres-exporter%22%7D' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["result"][0]["value"][1])'
)"

POSTGRES_DATABASE_UP="$(
  curl -fsS \
    'http://127.0.0.1:9090/api/v1/query?query=pg_up' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["result"][0]["value"][1])'
)"
REDIS_EXPORTER_UP="$(
  curl -fsS \
    'http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22redis-exporter%22%7D' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["result"][0]["value"][1])'
)"

REDIS_DATABASE_UP="$(
  curl -fsS \
    'http://127.0.0.1:9090/api/v1/query?query=redis_up' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["result"][0]["value"][1])'
)"

if [[ "$PROMETHEUS_UP" != "1" ]]; then
    echo "ERROR: Prometheus scrape target is DOWN."
    exit 1
fi

if [[ "$GRAFANA_UP" != "1" ]]; then
    echo "ERROR: Grafana scrape target is DOWN."
    exit 1
fi
if [[ "$POSTGRES_EXPORTER_UP" != "1" ]]; then
    echo "ERROR: PostgreSQL exporter scrape target is DOWN."
    exit 1
fi

if [[ "$POSTGRES_DATABASE_UP" != "1" ]]; then
    echo "ERROR: PostgreSQL exporter cannot reach PostgreSQL."
    exit 1
fi

if [[ "$REDIS_EXPORTER_UP" != "1" ]]; then
    echo "ERROR: Redis exporter scrape target is DOWN."
    exit 1
fi

if [[ "$REDIS_DATABASE_UP" != "1" ]]; then
    echo "ERROR: Redis exporter cannot reach Redis."
    exit 1
fi

echo "Prometheus target is UP."
echo "Grafana target is UP."
echo "PostgreSQL exporter target is UP."
echo "PostgreSQL database metric is UP."
echo "Redis exporter target is UP."
echo "Redis database metric is UP."
echo

echo "[5/10] Checking Alertmanager..."

curl -fsS http://127.0.0.1:9093/-/healthy
echo

ACTIVE_ALERTMANAGERS="$(
  curl -fsS http://127.0.0.1:9090/api/v1/alertmanagers \
    | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["data"]["activeAlertmanagers"]))'
)"

if [[ "$ACTIVE_ALERTMANAGERS" -lt 1 ]]; then
    echo "ERROR: Prometheus has no active Alertmanager."
    exit 1
fi

echo "Prometheus has an active Alertmanager."
echo

echo "[6/10] Checking Loki..."

LOKI_READY=""

for attempt in {1..12}; do
    LOKI_READY="$(
      curl -fsS http://127.0.0.1:3100/ready 2>/dev/null \
        | tr -d '\r\n' || true
    )"

    if [[ "$LOKI_READY" == "ready" ]]; then
        break
    fi

    echo "Waiting for Loki readiness... attempt ${attempt}/12"
    sleep 5
done

if [[ "$LOKI_READY" != "ready" ]]; then
    echo "ERROR: Loki did not become ready within 60 seconds."
    exit 1
fi

echo "Loki is ready."
echo

echo "[7/10] Checking Alloy..."

ALLOY_RUNNING="$(
  docker inspect \
    -f '{{.State.Running}}' \
    research-alloy 2>/dev/null || true
)"

if [[ "$ALLOY_RUNNING" != "true" ]]; then
    echo "ERROR: Alloy container is not running."
    exit 1
fi

RESEARCH_LOG_STREAM="$(
  curl -fsS \
    http://127.0.0.1:3100/loki/api/v1/label/container/values \
    | python3 -c '
import json
import sys

data = json.load(sys.stdin)
containers = data.get("data", [])

print(
    "1"
    if any(container.startswith("research-") for container in containers)
    else "0"
)
'
)"

if [[ "$RESEARCH_LOG_STREAM" != "1" ]]; then
    echo "ERROR: Loki contains no research container logs from Alloy."
    exit 1
fi

echo "Alloy container is running."
echo "Loki contains research container logs collected by Alloy."
echo

echo "[8/10] Checking Tempo..."

TEMPO_READY="$(
  curl -fsS http://127.0.0.1:3200/ready 2>/dev/null \
    | tr -d '\r\n' || true
)"

if [[ "$TEMPO_READY" != "ready" ]]; then
    echo "ERROR: Tempo is not ready."
    exit 1
fi

echo "Tempo is ready."
echo

echo "[9/10] Checking OpenTelemetry Collector..."

OTEL_RUNNING="$(
  docker inspect \
    -f '{{.State.Running}}' \
    research-otel-collector 2>/dev/null || true
)"

if [[ "$OTEL_RUNNING" != "true" ]]; then
    echo "ERROR: OpenTelemetry Collector container is not running."
    exit 1
fi

curl -fsS \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[]}' \
  http://127.0.0.1:4318/v1/traces \
  >/dev/null

echo "OpenTelemetry Collector is running."
echo "OTLP HTTP ingestion endpoint is responding."
echo

echo "[10/10] Checking Grafana..."

curl -fsS http://127.0.0.1:3001/api/health
echo

echo
echo "============================================"
echo " Local infrastructure is healthy."
echo "============================================"
