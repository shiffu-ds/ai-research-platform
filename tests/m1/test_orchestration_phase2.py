"""
Unit and Boundary tests for LangGraph Node Sequencing & Celery Boundary (GH-10, GH-11, v4.0 §5.1, §5.2).
"""

import pytest

from agents.orchestration.graph import ResearchGraphBuilder
from agents.orchestration.state import create_initial_research_state
from agents.orchestration.lifecycle import RunState
from backend.celery_tasks.research_worker import (
    assert_boundary_invariants,
    celery_app,
    CeleryLangGraphBoundaryViolation,
)


def test_langgraph_node_sequencing_execution():
    builder = ResearchGraphBuilder()
    app = builder.build()

    initial_state = create_initial_research_state(
        run_id="run-test-001",
        project_id="proj-auto-1",
        research_question="What are the latest breakthroughs in high-temperature superconductivity?",
    )

    final_state = app.invoke(initial_state)

    # Assert complete pipeline executed
    assert final_state["run_id"] == "run-test-001"
    assert final_state["research_plan"] is not None
    assert len(final_state["candidate_sources"]) > 0
    assert len(final_state["retrieval_results"]) > 0
    assert len(final_state["evidence"]) > 0
    assert final_state["analysis"] is not None
    assert final_state["report"] is not None
    assert final_state["validation_result"] is not None
    assert final_state["run_status"] == RunState.COMPLETED.value


def test_celery_boundary_invariants():
    # Audit check: Celery tasks must NOT register individual LangGraph nodes (§5.1)
    assert_boundary_invariants()

    # Artificially inject a forbidden task and assert boundary audit catches it
    @celery_app.task(name="research.node_planning")
    def fake_node_task():
        return "violation"

    with pytest.raises(CeleryLangGraphBoundaryViolation):
        assert_boundary_invariants()

    # Cleanup injected task
    celery_app.tasks.pop("research.node_planning", None)
