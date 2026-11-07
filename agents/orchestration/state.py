"""
Strongly typed shared ResearchState for LangGraph Orchestration (GH-10, v4.0 §5.2, §7, §9).
"""

from datetime import datetime, timezone
import re
from typing import Any, Optional
from typing_extensions import TypedDict
from pydantic import BaseModel, Field

from agents.exceptions import PromptInjectionError


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Secrets sanitizer pattern
SECRET_KEY_PATTERNS = [
    r"api[_-]?key",
    r"secret",
    r"password",
    r"token",
    r"auth",
    r"credentials",
]


def sanitize_state_dict(data: dict[str, Any]) -> dict[str, Any]:
    """Ensure no API keys, credentials, or secrets are persisted into state (§9)."""
    sanitized: dict[str, Any] = {}
    for k, v in data.items():
        k_lower = k.lower()
        if any(re.search(pat, k_lower) for pat in SECRET_KEY_PATTERNS):
            continue  # Drop secret field
        if isinstance(v, dict):
            sanitized[k] = sanitize_state_dict(v)
        elif isinstance(v, list):
            sanitized[k] = [
                sanitize_state_dict(item) if isinstance(item, dict) else item
                for item in v
            ]
        else:
            sanitized[k] = v
    return sanitized


class ResearchState(TypedDict, total=False):
    """
    Core TypedDict representation for LangGraph node processing.
    """
    run_id: str
    project_id: str
    created_by: str
    research_question: str
    project_context: dict[str, Any]
    research_plan: Optional[dict[str, Any]]
    candidate_sources: list[dict[str, Any]]
    retrieval_results: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    claims: list[dict[str, Any]]
    claim_evidence: list[dict[str, Any]]
    contradictions: list[dict[str, Any]]
    analysis: Optional[dict[str, Any]]
    report: Optional[dict[str, Any]]
    report_version: int
    validation_result: Optional[dict[str, Any]]
    repair_attempt: int
    current_stage: str
    run_status: str
    error: Optional[str]
    metadata: dict[str, Any]
    prompt_versions: dict[str, str]
    model_versions: dict[str, str]
    timestamps: dict[str, str]


def create_initial_research_state(
    run_id: str,
    project_id: str,
    research_question: str,
    created_by: str = "system",
    project_context: Optional[dict[str, Any]] = None,
    prompt_versions: Optional[dict[str, str]] = None,
    model_versions: Optional[dict[str, str]] = None,
) -> ResearchState:
    """Factory creating an initialized ResearchState free of secrets."""
    clean_context = sanitize_state_dict(project_context or {})
    now_iso = utc_now_iso()

    return {
        "run_id": run_id,
        "project_id": project_id,
        "created_by": created_by,
        "research_question": research_question,
        "project_context": clean_context,
        "research_plan": None,
        "candidate_sources": [],
        "retrieval_results": [],
        "evidence": [],
        "claims": [],
        "claim_evidence": [],
        "contradictions": [],
        "analysis": None,
        "report": None,
        "report_version": 1,
        "validation_result": None,
        "repair_attempt": 0,
        "current_stage": "INITIALIZED",
        "run_status": "QUEUED",
        "error": None,
        "metadata": {"schema_version": "v4.0"},
        "prompt_versions": prompt_versions or {"default": "v1.0"},
        "model_versions": model_versions or {"default": "v1.0"},
        "timestamps": {"created_at": now_iso, "started_at": now_iso},
    }
