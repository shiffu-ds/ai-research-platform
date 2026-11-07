# M5 Release Readiness Checklist

## Purpose

This checklist defines the minimum DevOps, Security, Reliability, QA, and
Operations requirements that must be reviewed before a release of the
Autonomous AI Research Platform is promoted to production.

A successful CI run does not automatically mean a release is production-ready.

---

## 1. Source Control

Before release:

- Target commit SHA is identified.
- Required pull request review is complete.
- Direct unreviewed changes to main are not used for production releases.
- Working tree and release branch contain no unintended files.
- Generated secrets, backups, Terraform state, and local environment files are
  not committed.

---

## 2. CI/CD

Required CI checks must pass:

- Docker Compose validation
- Shell script syntax validation
- Environment configuration validation
- Terraform formatting
- Terraform initialization
- Terraform validation
- Terraform plan validation
- Prometheus configuration validation
- Alertmanager configuration validation
- Loki configuration validation
- Grafana Alloy validation
- Tempo configuration validation
- OpenTelemetry Collector validation
- Infrastructure health checks
- PostgreSQL backup/restore verification
- Grafana provisioning checks
- Secret scanning
- SBOM generation
- Dependency vulnerability scanning
- Container vulnerability scanning

---

## 3. Security Gate

Production release must stop when a release-blocking CRITICAL vulnerability
remains unresolved.

HIGH severity findings require review and explicit risk acceptance according
to the project security policy.

Verify:

- No credentials are committed to Git.
- Gitleaks passes.
- Environment templates contain no secrets.
- Production credentials are not stored in Docker Compose.
- Production credentials are not stored in Terraform source.
- Terraform state is protected.
- Secrets use an approved production secret-management system.
- Container and dependency scan results are reviewed.

Known accepted development-only exceptions must never automatically become
production exceptions.

---

## 4. Infrastructure

Verify:

- PostgreSQL is healthy.
- Redis is healthy.
- Prometheus is healthy.
- Alertmanager is healthy.
- Grafana is healthy.
- Loki is healthy.
- Grafana Alloy is collecting logs.
- Tempo is healthy.
- OpenTelemetry Collector is healthy.
- Required application services are healthy.
- Required worker services are healthy.

Application and worker checks remain dependent on the runtime delivered by
their owning teams.

---

## 5. Observability

Before production release verify:

- Prometheus targets are UP.
- PostgreSQL metrics are available.
- Redis metrics are available.
- Infrastructure logs reach Loki.
- Distributed traces reach Tempo.
- Grafana datasources are working.
- Grafana dashboards are provisioned.
- Critical alerts are routed through Alertmanager.

Production release additionally requires an approved external notification
destination for critical alerts.

Examples include:

- Email
- Slack
- Microsoft Teams
- PagerDuty
- Another approved incident-management service

---

## 6. Backup and Recovery

Verify:

- PostgreSQL backup creation works.
- Backup output is non-empty.
- Restore into an isolated database works.
- Restored data matches expected data.
- Recovery test cleans up temporary databases.

The repository provides:

- scripts/backup-postgres.sh
- scripts/restore-postgres.sh
- scripts/verify-postgres-recovery.sh

Production additionally requires:

- Scheduled backups
- Defined retention
- Protected off-site backup storage
- Access controls
- Recovery ownership
- Defined RPO
- Defined RTO

---

## 7. Reliability

The reliability contract defines:

- Retry behavior
- Exponential backoff
- Retryable failures
- Non-retryable failures
- Dead-letter handling
- Idempotency requirements
- Timeout requirements
- Recovery expectations

Runtime retry and dead-letter implementation must be verified once the
backend/agent runtime is available.

The existence of the reliability contract alone does not prove runtime
reliability.

---

## 8. Terraform and Infrastructure as Code

Verify:

- terraform fmt -check passes.
- terraform validate passes.
- terraform plan is reviewed.
- Environment validation accepts only supported environments.
- Production infrastructure is represented through approved IaC.

Production additionally requires:

- Selected cloud or hosting platform
- Remote Terraform state
- State encryption
- State locking where supported
- Restricted state access
- Protected production variables
- Reviewed production plan

Terraform state must never be manually deleted to solve deployment problems.

---

## 9. Deployment and Rollback

Before deployment:

- Current release version is recorded.
- Last known-good release is known.
- Rollback procedure is available.
- Database migration risks are reviewed.
- A recent valid backup exists before destructive database changes.

After deployment:

- Run health checks.
- Run smoke tests.
- Review metrics.
- Review logs.
- Review traces.
- Review active alerts.

If critical validation fails, stop rollout and follow:

docs/runbooks/deployment-rollback.md

---

## 10. Application Security QA

When application runtime endpoints become available, verify:

- Authentication behavior
- Authorization behavior
- Input validation
- Prompt-injection defenses
- SSRF defenses
- Unsafe URL handling
- Secret leakage prevention
- Sensitive log redaction
- Error handling
- Rate-limit behavior
- Malformed request handling

These tests cannot be marked complete until the relevant backend/API runtime
exists.

---

## 11. Staging Gate

Before production, the release should first pass through staging.

Staging should use production-like:

- Networking
- Environment separation
- Secret injection
- Database connectivity
- Redis connectivity
- Logging
- Metrics
- Tracing
- Alerting
- Deployment procedure

Production promotion must not rely only on local development testing.

---

## 12. Production Blockers

A release must not be described as production-ready while any required
production dependency remains unresolved.

Current examples of platform-dependent requirements include:

- Final hosting platform
- Production secret manager
- Remote Terraform backend
- External Alertmanager notification receiver
- Production backup scheduling and off-site retention
- Staging deployment
- Production deployment strategy
- Application runtime smoke tests
- Runtime retry/DLQ integration

---

## 13. Release Evidence

For each production release retain evidence of:

- Commit SHA
- CI result
- Security scan results
- SBOM
- Terraform plan review
- Backup/recovery result
- Health-check result
- Smoke-test result
- Deployment timestamp
- Release version
- Rollback version
- Approver where required

A release should be traceable from source commit through deployment and
operational verification.
