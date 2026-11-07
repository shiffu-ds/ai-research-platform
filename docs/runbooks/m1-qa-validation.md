# M1 Orchestration - M5 QA Validation Report

## Validation Information

- Validation date: 2026-09-25
- Validated by: M5 - DevOps / Security / QA
- Source branch: orchestration
- Validated commit: 0cb02d409ec2fa96a52c786d8e1c184647038f01
- Validation environment: isolated local M5 QA environment

## Scope

M5 independently validated the M1 orchestration implementation before final team integration.

Validation covered:

- Python dependency resolution
- LangGraph orchestration
- research-agent workflow
- Celery/LangGraph boundary
- lifecycle state transitions
- cancellation handling
- idempotency and duplicate-run protection
- checkpoint handling
- validation and repair loop
- security-state sanitization
- prompt-injection protection
- SSRF protection
- real Redis integration
- cross-instance cancellation
- Celery reliability configuration
- evaluation/staging gate
- environment-driven Celery configuration
- automated M1 tests

## Test Environment

Python:

3.14.7

Temporary Python environment:

/tmp/m5-m1-venv

Redis image:

redis:7-alpine

Temporary Redis endpoint:

127.0.0.1:6380

Temporary Redis container:

m1-validation-redis

The temporary Redis container was removed after validation.

## Dependency Validation

Dependencies were resolved from:

requirements.txt

Important validated dependencies included:

- Pydantic
- LangGraph
- LangChain Core
- Redis Python client
- Celery
- Pytest
- Pytest Asyncio

Dependency integrity command:

python -m pip check

Result:

No broken requirements found.

Status: PASS

## Automated M1 Test Validation

Complete M1 test command:

python -m pytest tests/m1 -q

Result:

29 passed

Status: PASS

The validated tests covered orchestration, agents, lifecycle, idempotency, checkpoints, repair handling, routing, prompts, contracts, and evaluation behavior.

## Security Validation

M5 performed additional independent security checks outside the normal M1 test suite.

Validated controls:

- secret sanitization
- prompt-injection pattern detection
- external/untrusted source isolation
- SSRF protection
- private network blocking
- loopback blocking
- cloud metadata blocking

Security validation result:

PASS

### Secret Sanitization

Sensitive fields such as:

- api_key
- password
- token

were removed from persisted research state while normal fields remained available.

Status: PASS

### Prompt-Injection Protection

Tested malicious patterns included:

- ignore previous instructions
- admin override
- rm -rf

The security layer rejected the tested override patterns.

Status: PASS

### SSRF Protection

Tested blocked targets included:

- 127.0.0.1
- 10.0.0.1
- 169.254.169.254
- file:// URLs

All tested restricted targets were blocked.

Status: PASS

## Celery and LangGraph Boundary Validation

The architecture requires one Celery task per complete research run.

Individual LangGraph nodes must not be registered as separate Celery tasks.

M5 validated that:

- research.execute_run is the research Celery task
- individual planning/retrieval/evidence/analysis/report nodes are not separate Celery tasks

Status: PASS

## Celery Reliability Validation

Validated settings:

- maximum retries: 3
- default retry delay: 30 seconds
- task_acks_late: enabled
- task_reject_on_worker_lost: enabled

Status: PASS

## Real Redis Integration Validation

M5 started an isolated Redis container and tested the orchestration runtime against a real Redis server.

### Connectivity

Redis connectivity:

PASS

### Idempotency

The first run lock was accepted.

A duplicate lock for the same run was rejected using Redis SETNX behavior.

Validated idempotency TTL:

2700 seconds

This matches the 45-minute maximum research-run duration.

Status: PASS

### Lock Release

The run lock was released successfully and could then be acquired again.

Status: PASS

### Cancellation

A cancellation request created the Redis cancellation flag successfully.

Validated cancellation flag TTL:

3600 seconds

Lifecycle successfully transitioned through:

RUNNING -> CANCEL_REQUESTED -> CANCELLED

Status: PASS

### Cross-Instance Cancellation

Two separate lifecycle instances were connected to the same Redis service.

A cancellation request created by one instance was detected by the second instance.

Status: PASS

## Evaluation / Staging Gate Validation

M5 independently exercised the M1 evaluation gate.

Healthy evaluation data passed the staging gate.

Observed healthy test scores:

| Metric | Result |
| --- | ---: |
| Retrieval Recall@10 | 1.0000 |
| Retrieval Precision@10 | 1.0000 |
| Retrieval MRR | 1.0000 |
| Citation Correctness | 1.0000 |
| Supported Claim Rate | 1.0000 |
| Unsupported Claim Rate | 0.0000 |
| Contradiction Precision | 0.8500 |
| Contradiction Recall | 0.8200 |
| Contradiction F1 | 0.8347 |
| System Completion Rate | 0.9900 |
| System Failure Rate | 0.0100 |

Status:

PASS

M5 also supplied intentionally regressed retrieval data.

The staging gate correctly rejected the regression.

Examples of blocked metrics included:

- Retrieval Recall@10
- Retrieval Precision@10
- Retrieval MRR

Regression blocking status:

PASS

## M5 Integration Finding - Celery Redis Configuration

During QA, M5 identified one integration issue in:

backend/celery_tasks/research_worker.py

The validated source commit currently defines the Celery broker and result backend using hardcoded localhost Redis URLs:

redis://localhost:6379/1

redis://localhost:6379/2

The repository `.env.example` already provides:

CELERY_BROKER_URL

CELERY_RESULT_BACKEND

but the worker does not currently consume those environment variables.

This can cause incorrect Redis connectivity when the worker is executed inside Docker or another deployment environment.

## Tested M5 Fix

M5 locally tested a configuration change using:

CELERY_BROKER_URL = os.getenv(...)

CELERY_RESULT_BACKEND = os.getenv(...)

The local QA test successfully overrode the worker configuration with:

redis://test-redis:6379/5

redis://test-redis:6379/6

Result:

CELERY ENVIRONMENT OVERRIDE: PASS

After the local fix:

29 M1 tests still passed.

git diff --check also passed.

The tested patch was preserved locally as:

/tmp/m1-celery-env-fix.patch

This patch was NOT pushed to the orchestration branch.

The orchestration owner should apply an equivalent environment-driven configuration change and M5 should revalidate the new commit.

## M5 QA Result

Validated source commit:

0cb02d409ec2fa96a52c786d8e1c184647038f01

Validation results:

- Dependency integrity: PASS
- M1 automated tests: PASS
- LangGraph orchestration: PASS
- Celery boundary: PASS
- Lifecycle handling: PASS
- Idempotency: PASS
- Real Redis integration: PASS
- Cancellation: PASS
- Cross-instance cancellation: PASS
- Secret sanitization: PASS
- Prompt-injection protection: PASS
- SSRF protection: PASS
- Evaluation staging gate: PASS
- Regression blocking: PASS

Overall result:

M1 orchestration is QA-validated for the tested commit with one integration configuration finding.

The Celery broker/result backend should be changed to consume the existing environment variables before final Docker/platform integration.

This validation does not merge M1 into main.

If the orchestration branch changes after the validated commit, the relevant M5 QA tests must be rerun.

## Remaining Platform-Level Validation

Final platform validation still depends on integration of all team modules.

Pending checks include:

- adoption and revalidation of the Celery Redis environment fix
- merge/integration of M1 and M2
- backend/API integration
- frontend integration
- worker/background-job integration
- full application Docker builds
- application health checks
- authentication and authorization validation
- end-to-end RAG and orchestration workflow
- Retry/DLQ runtime integration
- final application-level security testing
- object-storage integration
- staging deployment validation
- production secret-manager integration
- final end-to-end smoke testing
- final release-readiness validation
