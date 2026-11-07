"""
Celery Worker & LangGraph Boundary Enforcement (GH-11, v4.0 §5.1).
Rule: ONE Celery task per research run.
Celery manages infrastructure/queuing; LangGraph manages research workflow and branching.
LangGraph nodes must NOT be converted into individual Celery tasks.
"""

import logging
from typing import Any, Optional
from celery import Celery

from agents.orchestration.graph import ResearchGraphBuilder
from agents.orchestration.lifecycle import ResearchRunLifecycle, RunState
from agents.orchestration.state import create_initial_research_state

logger = logging.getLogger("m1.celery_worker")

# Initialize Celery app conforming to M3/M5 runtime contract
celery_app = Celery(
    "research_orchestration",
    broker="redis://localhost:6379/1",
    backend="redis://localhost:6379/2",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)


class CeleryLangGraphBoundaryViolation(Exception):
    """Raised when an attempt is made to decompose LangGraph nodes into Celery tasks."""
    pass


@celery_app.task(
    bind=True,
    name="research.execute_run",
    max_retries=3,
    default_retry_delay=30,
)
def execute_research_run_task(
    self: Any,
    run_id: str,
    project_id: str,
    research_question: str,
    created_by: str = "system",
    project_context: Optional[dict[str, Any]] = None,
    prompt_versions: Optional[dict[str, str]] = None,
    model_versions: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """
    Authoritative single Celery task per research run (§5.1, §5.2).
    Dispatches to LangGraph which controls all intra-run conditional execution.
    """
    logger.info(
        "Celery received research run job",
        extra={"run_id": run_id, "project_id": project_id, "task_id": self.request.id},
    )

    lifecycle = ResearchRunLifecycle(run_id=run_id)
    lifecycle.transition(RunState.QUEUED, reason="Received by Celery worker")
    lifecycle.transition(RunState.STARTED, reason="Worker picked up the run")
    # Terminal outcomes (COMPLETED, VALIDATION_FAILED, CANCELLED, FAILED) are only
    # reachable from RUNNING in the lifecycle graph, so enter it before invoking.
    lifecycle.transition(RunState.RUNNING, reason="LangGraph execution commenced")

    # Build initial state
    initial_state = create_initial_research_state(
        run_id=run_id,
        project_id=project_id,
        research_question=research_question,
        created_by=created_by,
        project_context=project_context,
        prompt_versions=prompt_versions,
        model_versions=model_versions,
    )

    builder = ResearchGraphBuilder()
    app = builder.build()

    try:
        final_state = app.invoke(initial_state)
        terminal_status = final_state.get("run_status", RunState.COMPLETED.value)
        if terminal_status == RunState.COMPLETED.value:
            lifecycle.transition(RunState.COMPLETED, reason="LangGraph execution completed successfully")
        elif terminal_status == RunState.VALIDATION_FAILED.value:
            lifecycle.transition(RunState.VALIDATION_FAILED, reason="Validation repair limit reached")
        elif terminal_status == RunState.CANCELLED.value:
            lifecycle.transition(RunState.CANCELLED, reason="Cancellation token observed")
        elif terminal_status == RunState.FAILED.value:
            lifecycle.transition(RunState.FAILED, reason=final_state.get("error") or "Graph reported failure")
        return {
            "run_id": run_id,
            "status": terminal_status,
            "report": final_state.get("report"),
            "validation_result": final_state.get("validation_result"),
        }
    except Exception as exc:
        logger.error(f"Execution failed for run {run_id}: {exc}", exc_info=True)
        # Infrastructure-level retry handled by Celery
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))
        lifecycle.transition(RunState.FAILED, reason=str(exc))
        raise exc


def assert_boundary_invariants() -> None:
    """
    Audit check (§5.1): Verify that individual LangGraph agent nodes
    (e.g., node_planning, node_retrieval) are NEVER registered as standalone Celery tasks.
    """
    forbidden_task_prefixes = [
        "research.node_planning",
        "research.node_source_discovery",
        "research.node_retrieval",
        "research.node_evidence",
        "research.node_contradiction",
        "research.node_analysis",
        "research.node_report",
        "research.node_validation",
    ]
    registered_tasks = set(celery_app.tasks.keys())
    violations = [t for t in forbidden_task_prefixes if t in registered_tasks]
    if violations:
        raise CeleryLangGraphBoundaryViolation(
            f"Boundary violation detected: LangGraph nodes {violations} registered as Celery tasks! "
            f"Rule §5.1 requires one Celery task per research run."
        )
