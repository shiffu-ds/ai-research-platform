"""
Research Run Lifecycle State Machine (GH-12, v4.0 §7).
Defines states, valid transitions, cancellation checking, and retry rules.
"""

from datetime import datetime, timezone
from enum import Enum
import logging
import time
from typing import Any, Optional

logger = logging.getLogger("m1.lifecycle")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RunState(str, Enum):
    CREATED = "CREATED"
    QUEUED = "QUEUED"
    STARTED = "STARTED"
    RUNNING = "RUNNING"
    PLANNING = "PLANNING"
    SOURCE_DISCOVERY = "SOURCE_DISCOVERY"
    RETRIEVAL = "RETRIEVAL"
    EVIDENCE = "EVIDENCE"
    CONTRADICTION = "CONTRADICTION"
    ANALYSIS = "ANALYSIS"
    REPORT = "REPORT"
    VALIDATING = "VALIDATING"
    REPAIRING = "REPAIRING"
    PAUSED = "PAUSED"
    RESUMED = "RESUMED"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    VALIDATION_FAILED = "VALIDATION_FAILED"


class LifecycleTransitionError(Exception):
    def __init__(self, from_state: RunState, to_state: RunState, reason: str = ""):
        msg = f"Invalid lifecycle transition from {from_state.value} to {to_state.value}. {reason}".strip()
        super().__init__(msg)
        self.from_state = from_state
        self.to_state = to_state


class ResearchRunLifecycle:
    """
    State machine enforcing §7.1 concrete transition rules,
    SLA checks, and graceful cancellation.
    """

    MAX_QUEUED_WAIT_SECONDS = 300  # 5 minutes
    MAX_RUN_DURATION_SECONDS = 2700  # 45 minutes
    MAX_RECOVERABLE_RETRIES = 3
    RETRY_BACKOFF_SCHEDULE = [30, 120, 480]  # seconds

    NON_RECOVERABLE_ERRORS = {
        "AUTHORIZATION_ERROR",
        "VALIDATION_ERROR",
        "SECURITY_ERROR",
        "SSRF_BLOCKED",
    }

    # Strict transition graph
    VALID_TRANSITIONS: dict[RunState, set[RunState]] = {
        RunState.CREATED: {RunState.QUEUED, RunState.FAILED, RunState.CANCELLED},
        RunState.QUEUED: {RunState.STARTED, RunState.RUNNING, RunState.CANCEL_REQUESTED, RunState.CANCELLED, RunState.FAILED},
        RunState.STARTED: {RunState.RUNNING, RunState.PLANNING, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.RUNNING: {
            RunState.PLANNING,
            RunState.SOURCE_DISCOVERY,
            RunState.RETRIEVAL,
            RunState.EVIDENCE,
            RunState.CONTRADICTION,
            RunState.ANALYSIS,
            RunState.REPORT,
            RunState.VALIDATING,
            RunState.REPAIRING,
            RunState.PAUSED,
            RunState.CANCEL_REQUESTED,
            RunState.CANCELLED,
            RunState.COMPLETED,
            RunState.FAILED,
            RunState.VALIDATION_FAILED,
        },
        RunState.PLANNING: {RunState.SOURCE_DISCOVERY, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.SOURCE_DISCOVERY: {RunState.RETRIEVAL, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.RETRIEVAL: {RunState.EVIDENCE, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.EVIDENCE: {RunState.CONTRADICTION, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.CONTRADICTION: {RunState.ANALYSIS, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.ANALYSIS: {RunState.REPORT, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.REPORT: {RunState.VALIDATING, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.VALIDATING: {RunState.COMPLETED, RunState.REPAIRING, RunState.VALIDATION_FAILED, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.REPAIRING: {RunState.REPORT, RunState.VALIDATION_FAILED, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.PAUSED: {RunState.RESUMED, RunState.CANCEL_REQUESTED, RunState.CANCELLED},
        RunState.RESUMED: {RunState.RUNNING, RunState.CANCEL_REQUESTED, RunState.FAILED},
        RunState.CANCEL_REQUESTED: {RunState.CANCELLED, RunState.FAILED},
        RunState.CANCELLED: set(),  # Terminal
        RunState.COMPLETED: set(),  # Terminal
        RunState.FAILED: {RunState.RESUMED, RunState.QUEUED},  # Resumable if flagged
        RunState.VALIDATION_FAILED: set(),  # Terminal
    }

    def __init__(self, run_id: str, redis_client: Optional[Any] = None):
        self.run_id = run_id
        self.current_state = RunState.CREATED
        self.created_at = utc_now()
        self.started_at: Optional[datetime] = None
        self.retry_count = 0
        self.redis_client = redis_client
        self._cancellation_requested = False

    def can_transition(self, to_state: RunState) -> bool:
        """Check if transition from current state is allowable."""
        allowed = self.VALID_TRANSITIONS.get(self.current_state, set())
        return to_state in allowed

    def transition(self, to_state: RunState, reason: str = "") -> RunState:
        """Transition state machine to to_state, enforcing validation."""
        if not self.can_transition(to_state):
            raise LifecycleTransitionError(self.current_state, to_state, reason)

        prev_state = self.current_state
        self.current_state = to_state

        if to_state in (RunState.STARTED, RunState.RUNNING) and not self.started_at:
            self.started_at = utc_now()

        logger.info(
            "Lifecycle transition executed",
            extra={
                "run_id": self.run_id,
                "prev_state": prev_state.value,
                "new_state": to_state.value,
                "reason": reason,
            },
        )
        return self.current_state

    # -------------------------------------------------------------
    # Cancellation Flow (§7.2)
    # -------------------------------------------------------------

    def request_cancellation(self) -> None:
        """Called when user or API triggers cancellation."""
        self._cancellation_requested = True
        if self.redis_client:
            try:
                self.redis_client.set(f"cancel_run:{self.run_id}", "1", ex=3600)
            except Exception as e:
                logger.warning(f"Failed to set Redis cancellation flag for {self.run_id}: {e}")
        if self.can_transition(RunState.CANCEL_REQUESTED):
            self.transition(RunState.CANCEL_REQUESTED, reason="Cancellation requested by client")

    def check_cancellation(self) -> bool:
        """
        Checked by worker at LangGraph node boundaries.
        Target SLA: observed within 10s.
        """
        if self._cancellation_requested:
            return True
        if self.redis_client:
            try:
                val = self.redis_client.get(f"cancel_run:{self.run_id}")
                if val and (val == b"1" or val == "1"):
                    self._cancellation_requested = True
                    return True
            except Exception as e:
                logger.warning(f"Failed to check Redis cancellation flag for {self.run_id}: {e}")
        return False

    def is_terminal(self) -> bool:
        return self.current_state in {
            RunState.COMPLETED,
            RunState.CANCELLED,
            RunState.FAILED,
            RunState.VALIDATION_FAILED,
        }
