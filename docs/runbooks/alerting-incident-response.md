# Alerting and Incident Response Runbook

## Purpose

This runbook defines how M5 investigates and responds to infrastructure alerts
for the Autonomous AI Research Platform.

The monitoring stack includes Prometheus, Alertmanager, Grafana, Loki, Alloy,
Tempo, PostgreSQL exporter, Redis exporter, and OpenTelemetry Collector.

## 1. Current Alert Coverage

Current alert rules cover:

- Monitoring target unavailable
- PostgreSQL unavailable
- Redis unavailable

Prometheus evaluates the rules and routes active alerts to Alertmanager.

## 2. Initial Response

When an alert fires:

1. Record the alert name and start time.
2. Identify the affected service.
3. Check Docker container status.
4. Run the M5 health check.
5. Review Prometheus metrics.
6. Review Grafana.
7. Review Loki logs.
8. Review Tempo traces when relevant.
9. Determine user or service impact.
10. Record recovery actions.

## 3. Check Container Status

Run:

    docker compose ps

Look for:

- Exited containers
- Unhealthy containers
- Restart loops
- Missing services

Do not delete persistent Docker volumes during initial investigation.

## 4. Run the Health Check

Run:

    ./scripts/check-local-stack.sh

A healthy stack should finish with:

    Local infrastructure is healthy.

The script verifies PostgreSQL, Redis, Prometheus, Alertmanager, Loki, Alloy,
Tempo, OpenTelemetry Collector, and Grafana.

## 5. PostgreSQL Incident

Check status:

    docker compose ps postgres

Review logs:

    docker compose logs postgres

Check readiness:

    docker compose exec -T postgres \
      pg_isready -U research -d research

Expected healthy result:

    accepting connections

Do not delete the PostgreSQL volume during troubleshooting.

If database recovery is required, follow:

    docs/runbooks/postgres-backup-restore.md

## 6. Redis Incident

Check status:

    docker compose ps redis

Review logs:

    docker compose logs redis

Verify Redis:

    docker compose exec -T redis redis-cli ping

Expected result:

    PONG

Redis may report a Linux `vm.overcommit_memory` warning. This is a host-level
hardening item and should be reviewed before production deployment.

## 7. Prometheus Target Down

If Prometheus reports a target as DOWN:

1. Identify the failed job.
2. Check the related container.
3. Check exporter logs.
4. Confirm service networking.
5. Verify the configured scrape target.
6. Run the local health check again.

Do not disable an alert rule simply to make the alert disappear.

## 8. Alertmanager

Check Alertmanager:

    docker compose ps alertmanager

Review logs:

    docker compose logs alertmanager

Prometheus should report at least one active Alertmanager.

The current implementation verifies alert routing and resolution.

## 9. Loki and Alloy

Alloy collects Docker logs from `research-*` containers and sends them to Loki.

Check Alloy:

    docker compose ps alloy

Review Alloy logs:

    docker compose logs alloy

Check Loki readiness:

    curl -fsS http://127.0.0.1:3100/ready

The health check verifies that Alloy is running and Loki contains logs from
research containers.

## 10. Grafana

Grafana is used to review:

- Infrastructure status
- PostgreSQL status
- Redis status
- Prometheus metrics
- Centralized logs

Grafana should support investigation but should not be the only health signal.

## 11. Tempo and Tracing

Tempo stores distributed traces.

When application tracing is available, use traces to investigate:

- Failed requests
- Slow requests
- Dependency failures
- Cross-service behavior

Record useful trace IDs as incident evidence.

## 12. Incident Resolution

After fixing the issue:

1. Confirm the affected service is healthy.
2. Run `./scripts/check-local-stack.sh`.
3. Confirm Prometheus targets return to UP.
4. Confirm Alertmanager receives the resolved state.
5. Confirm Grafana shows recovery.
6. Review logs for recurring errors.
7. Record the resolution time.

An alert should resolve because the underlying problem was fixed.

## 13. Incident Evidence

Record:

- Alert name
- Severity
- Start time
- Resolution time
- Affected service
- Symptoms
- Operational impact
- Relevant logs
- Relevant metrics
- Relevant trace IDs
- Root cause
- Recovery actions
- Follow-up actions

## 14. External Notifications

The current Alertmanager setup verifies detection, routing, and resolution.

Production additionally requires an external notification destination such as:

- Email
- Slack
- Microsoft Teams
- PagerDuty
- Another approved incident-management service

The final receiver depends on team requirements.

## 15. Production Requirements

Before production:

- Critical alerts must have an external receiver.
- Notification delivery must be tested.
- Alert ownership must be defined.
- Escalation responsibility must be defined.
- False positives should be reviewed.
- Application-level alerts should be added when runtime metrics exist.

Production alerting must not depend only on someone manually checking Grafana.

## 16. Current Verified Capabilities

Currently verified:

- Prometheus alert evaluation
- Alertmanager connectivity
- Alert routing
- Alert resolution
- PostgreSQL monitoring
- Redis monitoring
- Monitoring-target alerts
- Centralized Loki logging
- Alloy Docker log collection
- Tempo distributed tracing
- Automated infrastructure health checks

## 17. Current Limitations

Still pending for production:

- External Alertmanager notification receiver
- Production escalation ownership
- Application-level alert rules
- Business-level alert rules
- Production incident-management integration
- Production on-call procedures

These depend on the final application runtime, hosting environment, and team
communication process.
