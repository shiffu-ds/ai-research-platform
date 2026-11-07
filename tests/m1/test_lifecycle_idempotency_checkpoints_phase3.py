"""
Tests for Run Lifecycle, Idempotency, and Checkpoints (GH-12, GH-13, GH-14, v4.0 §7, §8, §9).
"""

import pytest

from agents.orchestration.checkpoints import CheckpointRepository
from agents.orchestration.idempotency import IdempotencyManager, RunIdempotencyIdentity
from agents.orchestration.lifecycle import LifecycleTransitionError, ResearchRunLifecycle, RunState
from agents.orchestration.state import create_initial_research_state


# --- GH-12: Lifecycle State Machine Tests ---
def test_lifecycle_transitions_and_rejection():
    lifecycle = ResearchRunLifecycle(run_id="run-life-1")
    assert lifecycle.current_state == RunState.CREATED

    lifecycle.transition(RunState.QUEUED)
    lifecycle.transition(RunState.RUNNING)
    assert lifecycle.started_at is not None

    # Invalid jump: RUNNING directly to CREATED
    with pytest.raises(LifecycleTransitionError):
        lifecycle.transition(RunState.CREATED)


def test_lifecycle_cancellation_flow(mock_redis):
    lifecycle = ResearchRunLifecycle(run_id="run-cancel-1", redis_client=mock_redis)
    lifecycle.transition(RunState.QUEUED)
    lifecycle.transition(RunState.RUNNING)

    assert lifecycle.check_cancellation() is False

    # Trigger cancellation
    lifecycle.request_cancellation()
    assert lifecycle.check_cancellation() is True
    assert lifecycle.current_state == RunState.CANCEL_REQUESTED

    # Acknowledge and transition to terminal CANCELLED
    lifecycle.transition(RunState.CANCELLED)
    assert lifecycle.current_state == RunState.CANCELLED
    assert lifecycle.is_terminal() is True


# --- GH-13: Idempotency Tests ---
def test_idempotency_hashing_and_deduplication(mock_redis):
    identity1 = RunIdempotencyIdentity(
        run_id="run-idem-1",
        project_id="proj-1",
        created_by="user-1",
        configuration={"model": "gpt-4o", "temperature": 0.2},
        prompt_versions={"planner": "v1.0"},
    )
    identity2 = RunIdempotencyIdentity(
        run_id="run-idem-1",
        project_id="proj-1",
        created_by="user-1",
        configuration={"model": "gpt-4o", "temperature": 0.2},
        prompt_versions={"planner": "v1.0"},
    )
    # Hashes must be identical for identical configuration
    assert identity1.composite_hash == identity2.composite_hash

    manager = IdempotencyManager(redis_client=mock_redis)
    # First delivery succeeds
    assert manager.acquire_lock("run-idem-1") is True
    # Duplicate delivery within 45m TTL is rejected
    assert manager.acquire_lock("run-idem-1") is False


# --- GH-14: Checkpoint and Resume Tests ---
def test_checkpoint_serialization_without_secrets():
    repo = CheckpointRepository()
    state = create_initial_research_state(
        run_id="run-chk-1",
        project_id="proj-chk",
        research_question="Quantum sensor limits",
        project_context={"api_key": "SK-SECRET-12345", "safe_parameter": "value"},
    )
    # Context should already have had api_key stripped
    assert "api_key" not in state["project_context"]

    # Add evidence and save checkpoint
    state["evidence"] = [
        {"evidence_id": "ev-chk-1", "excerpt": "Sample excerpt", "document_chunk_id": "chk-1"}
    ]
    snapshot = repo.save_checkpoint(state, current_node="retrieval")

    assert snapshot.run_id == "run-chk-1"
    assert snapshot.current_node == "retrieval"
    assert "ev-chk-1" in snapshot.retrieved_evidence_references

    # Resume state
    resumed = repo.resume_state("run-chk-1")
    assert resumed is not None
    assert resumed["run_status"] == "RESUMED"
    assert resumed["run_id"] == "run-chk-1"
