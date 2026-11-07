"""
LangGraph Checkpoint Serialization & Resume Manager (GH-14, v4.0 §9).
Persists resumable state snapshots without sensitive credentials,
supports stage re-entry skipping completed deterministic work.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Optional
from pydantic import BaseModel, Field

from agents.orchestration.state import ResearchState, sanitize_state_dict, utc_now_iso

logger = logging.getLogger("m1.checkpoints")

CHECKPOINT_SCHEMA_VERSION = "v4.0"
CHECKPOINT_TTL_DAYS = 14  # 14 days (§7.1, §9)


class CheckpointSnapshot(BaseModel):
    """
    JSONB-compatible schema for research_checkpoints table (§9).
    Strictly forbids credentials and stores evidence references as IDs.
    """
    checkpoint_id: str
    run_id: str
    schema_version: str = CHECKPOINT_SCHEMA_VERSION
    current_node: str
    graph_state: dict[str, Any]
    research_plan: Optional[dict[str, Any]] = None
    retrieved_evidence_references: list[str] = Field(default_factory=list)
    validation_status: Optional[dict[str, Any]] = None
    prompt_versions: dict[str, str] = Field(default_factory=dict)
    model_versions: dict[str, str] = Field(default_factory=dict)
    execution_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=utc_now_iso)


class CheckpointRepository:
    """
    In-memory / M3 PostgreSQL boundary repository for research checkpoints (§9).
    """

    def __init__(self, db_session: Optional[Any] = None):
        self.db_session = db_session
        self._store: dict[str, list[CheckpointSnapshot]] = {}

    def save_checkpoint(self, state: ResearchState, current_node: str) -> CheckpointSnapshot:
        """Create and persist a sanitized checkpoint snapshot."""
        # Sanitize state - NO SECRETS
        clean_state = sanitize_state_dict(dict(state))

        # Extract evidence references as IDs only (§9)
        ev_items = state.get("evidence", [])
        ev_refs = [
            e.get("evidence_id") if isinstance(e, dict) else getattr(e, "evidence_id", "")
            for e in ev_items
        ]
        ev_refs = [ref for ref in ev_refs if ref]

        checkpoint_id = f"chk_{state['run_id']}_{current_node}_{int(datetime.now().timestamp())}"

        snapshot = CheckpointSnapshot(
            checkpoint_id=checkpoint_id,
            run_id=state["run_id"],
            current_node=current_node,
            graph_state=clean_state,
            research_plan=state.get("research_plan"),
            retrieved_evidence_references=ev_refs,
            validation_status=state.get("validation_result"),
            prompt_versions=state.get("prompt_versions", {}),
            model_versions=state.get("model_versions", {}),
            execution_metadata={
                "repair_attempt": state.get("repair_attempt", 0),
                "report_version": state.get("report_version", 1),
            },
        )

        if state["run_id"] not in self._store:
            self._store[state["run_id"]] = []
        self._store[state["run_id"]].append(snapshot)

        logger.info(
            "Checkpoint saved successfully",
            extra={"run_id": state["run_id"], "node": current_node, "chk_id": checkpoint_id},
        )
        return snapshot

    def get_latest_checkpoint(self, run_id: str) -> Optional[CheckpointSnapshot]:
        """Fetch latest checkpoint for resuming a paused/failed run."""
        snapshots = self._store.get(run_id, [])
        return snapshots[-1] if snapshots else None

    def resume_state(self, run_id: str) -> Optional[ResearchState]:
        """
        Reconstruct ResearchState from the latest checkpoint.
        Allows resuming without re-executing completed deterministic stages (§7.1, §9).
        """
        snapshot = self.get_latest_checkpoint(run_id)
        if not snapshot:
            logger.warning(f"No checkpoint found to resume run {run_id}")
            return None

        resumed_state: ResearchState = dict(snapshot.graph_state)  # type: ignore
        resumed_state["run_status"] = "RESUMED"
        resumed_state["timestamps"] = {
            **resumed_state.get("timestamps", {}),
            "resumed_at": utc_now_iso(),
        }
        logger.info(
            "Run successfully resumed from checkpoint",
            extra={"run_id": run_id, "resumed_from_node": snapshot.current_node},
        )
        return resumed_state
