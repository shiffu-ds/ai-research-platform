# M5 Reliability Contract

## Purpose

This document defines the minimum reliability requirements for asynchronous
jobs, research tasks, AI-agent executions, external API calls, and background
workers in the Autonomous AI Research Platform.

The application teams may choose their worker framework, but the runtime must
satisfy these operational requirements.

---

## 1. Retry Policy

Transient failures must be retried automatically.

Recommended default:

- Maximum attempts: 4 total attempts
- Initial retry delay: 2 seconds
- Backoff strategy: exponential
- Backoff sequence: 2s, 4s, 8s
- Optional jitter should be used to avoid retry storms

Retryable examples:

- Temporary network failures
- HTTP 429 rate limiting
- HTTP 502 / 503 / 504
- Temporary database connectivity failure
- Temporary Redis connectivity failure
- AI provider timeout
- Object-storage timeout

---

## 2. Non-Retryable Failures

Permanent or validation failures must not be repeatedly retried.

Examples:

- Invalid input
- Authentication failure caused by invalid credentials
- Authorization denial
- Unsupported request
- Schema-validation failure
- Malformed payload
- Explicit application rejection

These failures should be recorded immediately.

---

## 3. Dead-Letter Queue

After the maximum retry count is reached, the failed job must be moved to a
dead-letter mechanism.

Each dead-letter record should contain:

- Job ID
- Job type
- Failure timestamp
- Retry count
- Final error type
- Final error message
- Correlation / trace ID when available
- Original job payload or safe payload reference

Sensitive secrets must not be stored in dead-letter records.

---

## 4. Idempotency

Retrying a job must not unintentionally duplicate irreversible operations.

Where applicable, jobs should use:

- Stable job IDs
- Idempotency keys
- Database uniqueness constraints
- State checks before repeated writes

---

## 5. Timeout Requirements

External operations must have finite timeouts.

No external API, AI provider, database call, or background task should wait
indefinitely.

Timeout values may differ by subsystem, but the timeout must be explicitly
configured.

---

## 6. Observability

Every failed job should produce structured logs containing:

- job_id
- job_type
- attempt
- max_attempts
- error_type
- error_message
- trace_id when available

Metrics should eventually expose:

- jobs_started_total
- jobs_completed_total
- jobs_failed_total
- jobs_retried_total
- jobs_dead_lettered_total

Distributed traces should include retry attempts where practical.

---

## 7. Recovery

Operators must be able to:

1. Inspect failed/dead-lettered jobs.
2. Determine the reason for failure.
3. Correct the underlying problem.
4. Replay an eligible failed job safely.
5. Confirm successful completion.

---

## 8. Production Rule

A job-processing component is not considered production-ready until:

- Retry behavior is tested
- Permanent failures are not endlessly retried
- Retry exhaustion is tested
- Dead-letter handling is tested
- Duplicate processing risk is controlled
- Relevant logs and metrics are available

---

## Current Integration Status

The current M5 branch provides the infrastructure and observability platform.

Application worker integration is pending the backend/agent runtime contract
from the responsible application team.
