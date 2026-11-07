# Deployment and Rollback Runbook

## Purpose

This runbook defines the release validation and rollback procedure for the
Autonomous AI Research Platform.

The current repository provides infrastructure validation and CI/CD checks.
The final production deployment mechanism will be selected when the deployment
platform is confirmed.

## 1. Pre-Deployment Checks

Before promoting a release:

1. Confirm the target commit SHA.
2. Confirm CI is successful.
3. Confirm secret scanning passes.
4. Confirm dependency and container security scans have completed.
5. Confirm Terraform validation passes.
6. Confirm infrastructure health checks pass.
7. Confirm PostgreSQL backup and recovery verification passes.
8. Confirm environment configuration validation passes.
9. Review unresolved CRITICAL and HIGH security findings.
10. Do not deploy production when a blocking CRITICAL finding remains.

## 2. Deployment Principle

Deployments should use immutable application artifacts.

A production deployment should not modify application code directly on a
running server.

Preferred production strategies include:

- Blue/green deployment
- Canary deployment
- Versioned container images

The final strategy depends on the selected hosting platform.

## 3. Post-Deployment Validation

After deployment, verify:

- Application/API health
- PostgreSQL connectivity
- Redis connectivity
- Required workers are running
- Prometheus targets are healthy
- Grafana is reachable
- Loki receives logs
- Tempo receives traces
- Alertmanager is operational
- Critical application workflows complete successfully

If any critical validation fails, begin rollback.

## 4. Rollback Triggers

Rollback should be considered when:

- Application health checks repeatedly fail
- Critical endpoints become unavailable
- Database migrations fail
- Error rates increase significantly
- Critical functionality is broken
- Security validation detects a release-blocking issue
- Infrastructure changes make the platform unstable

## 5. Application Rollback

The production deployment platform should keep the previously known-good
application version available.

Rollback procedure:

1. Stop further rollout.
2. Identify the last known-good release.
3. Record the failing release commit SHA.
4. Restore traffic to the previous application version.
5. Run health and smoke checks.
6. Verify metrics, logs, traces, and alerts.
7. Document the incident and failure cause.

Do not delete evidence or logs related to the failed release.

## 6. Infrastructure Rollback

Infrastructure changes must be reviewed before rollback.

Terraform must not be blindly rolled back by deleting state or manually
editing state files.

Procedure:

1. Review the Terraform plan associated with the failed change.
2. Identify the infrastructure resource that caused the failure.
3. Prepare a corrective Terraform change.
4. Run:

   terraform fmt -check
   terraform validate
   terraform plan

5. Review the plan before applying it.
6. Apply only through the approved deployment process.

Terraform state must remain protected.

## 7. Database Migration Safety

Database migrations require additional care because application rollback does
not automatically reverse database changes.

Migration rules:

- Prefer backward-compatible migrations.
- Do not automatically destroy production data.
- Take or verify a recent backup before destructive migration work.
- Test restore procedures before production use.
- Treat irreversible schema changes as high-risk operations.

A rollback must not restore an old database backup unless the consequences of
data loss are understood and explicitly approved.

## 8. PostgreSQL Recovery

The repository provides:

- scripts/backup-postgres.sh
- scripts/restore-postgres.sh
- scripts/verify-postgres-recovery.sh

The recovery verification script tests backup creation, restoration, and data
integrity using isolated temporary databases.

Production recovery requires an approved backup retention and off-site storage
policy.

## 9. Observability During Rollback

During a failed deployment or rollback, review:

- Prometheus metrics
- Grafana dashboards
- Loki logs
- Tempo traces
- Alertmanager alerts

Record relevant timestamps, release versions, errors, and trace identifiers.

## 10. Incident Record

For every production rollback, record:

- Date and time
- Release version / commit SHA
- Trigger for rollback
- Impact
- Detection method
- Rollback actions
- Recovery time
- Root cause
- Follow-up actions

## 11. Current Limitations

The repository currently does not claim a completed production blue/green or
canary deployment.

Cloud-specific deployment, remote Terraform state, production secret
management, and traffic-switching mechanisms remain dependent on the final
hosting platform.
