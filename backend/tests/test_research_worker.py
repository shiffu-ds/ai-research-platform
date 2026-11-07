"""
The research-run Celery task, executed in-process with Task.apply()
(no broker needed). Guards the lifecycle path a real run takes.
"""

import pytest

from agents.orchestration.lifecycle import ResearchRunLifecycle, RunState
from backend.celery_tasks.research_worker import celery_app, execute_research_run_task


def run_task(**kwargs):
    defaults = {
        "run_id": "run-worker-test",
        "project_id": "proj-worker-test",
        "research_question": "What are the latest breakthroughs in high-temperature superconductivity?",
    }
    result = execute_research_run_task.apply(kwargs={**defaults, **kwargs})
    return result


def test_successful_run_completes_without_retrying():
    result = run_task()
    assert result.successful(), result.traceback
    payload = result.get()
    assert payload["status"] == RunState.COMPLETED.value
    assert payload["report"] is not None


@pytest.mark.parametrize(
    "terminal",
    [RunState.COMPLETED, RunState.VALIDATION_FAILED, RunState.CANCELLED, RunState.FAILED],
)
def test_every_graph_outcome_is_a_legal_lifecycle_transition(terminal):
    # The worker walks CREATED -> QUEUED -> STARTED -> RUNNING before invoking
    # the graph; each terminal outcome must be reachable from RUNNING.
    lifecycle = ResearchRunLifecycle(run_id="run-lifecycle-path")
    for step in (RunState.QUEUED, RunState.STARTED, RunState.RUNNING):
        lifecycle.transition(step)
    assert lifecycle.can_transition(terminal)


def test_broker_and_backend_follow_environment():
    # Run in a fresh interpreter: reloading the module here would replace the
    # shared celery_app that other tests hold a reference to.
    import json
    import os
    import subprocess
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    env = {
        **os.environ,
        "CELERY_BROKER_URL": "redis://redis:6379/1",
        "CELERY_RESULT_BACKEND": "redis://redis:6379/2",
        "PYTHONPATH": str(root),
    }
    code = (
        "import json; from backend.celery_tasks.research_worker import celery_app as a; "
        "print(json.dumps([a.conf.broker_url, a.conf.result_backend]))"
    )
    out = subprocess.run([sys.executable, "-c", code], env=env, cwd=root, capture_output=True, text=True, check=True)
    assert json.loads(out.stdout.strip().splitlines()[-1]) == ["redis://redis:6379/1", "redis://redis:6379/2"]


def test_celery_app_is_the_module_singleton():
    assert execute_research_run_task.app is celery_app
