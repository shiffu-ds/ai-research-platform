"""
Model Routing Policy and Fallback Engine (GH-15, v4.0 §22).
Implements Primary -> Secondary -> Fallback progression,
filtering on quality, latency, context size, and cost,
with audit trail logging for fallback events.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Optional
from pydantic import BaseModel, Field

from agents.routing.configs import DEFAULT_MODEL_REGISTRY, ModelConfig

logger = logging.getLogger("m1.routing")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class FallbackEvent(BaseModel):
    """
    Recorded in run audit metadata whenever a fallback occurs (§22).
    Enables exact reproducibility of runs with non-deterministic runtime routing.
    """
    from_model: str
    to_model: str
    reason: str  # "TIMEOUT", "RATE_LIMIT", "OUTAGE", "CONTEXT_SIZE"
    task_type: str
    timestamp: str = Field(default_factory=utc_now_iso)


class ModelRouter:
    """
    Policy engine selecting primary, secondary, and fallback models (§22).
    """

    QUALITY_RANKS = {"frontier": 4, "high": 3, "standard": 2, "economy": 1}

    def __init__(self, registry: Optional[dict[str, ModelConfig]] = None):
        self.registry = registry or DEFAULT_MODEL_REGISTRY
        self.fallback_audit_trail: list[FallbackEvent] = []

    def get_eligible_models(
        self,
        task_type: str,
        required_quality: str = "high",
        context_needed: int = 4000,
    ) -> list[ModelConfig]:
        """Filter eligible models based on task, quality tier, and context limit."""
        min_quality_val = self.QUALITY_RANKS.get(required_quality, 2)
        eligible = []

        for m in self.registry.values():
            if not m.is_active:
                continue
            if task_type not in m.supported_task_types:
                continue
            m_qual = self.QUALITY_RANKS.get(m.quality_tier, 1)
            if m_qual < min_quality_val:
                continue
            if m.context_window < context_needed:
                continue
            eligible.append(m)

        return eligible

    def select_route_chain(
        self,
        task_type: str,
        required_quality: str = "high",
        context_needed: int = 4000,
        prefer_low_latency: bool = False,
    ) -> list[ModelConfig]:
        """
        Builds [PRIMARY, SECONDARY, FALLBACK] chain.
        Sorted by latency (if on critical SSE path) or cost (as tie-breaker).
        """
        eligible = self.get_eligible_models(task_type, required_quality, context_needed)
        if not eligible:
            # Fall back to any active model supporting task type
            eligible = [m for m in self.registry.values() if task_type in m.supported_task_types]

        if not eligible:
            raise ValueError(f"No available models for task '{task_type}'.")

        if prefer_low_latency:
            sorted_models = sorted(eligible, key=lambda m: (m.p95_latency_ms, m.cost_per_1k_tokens))
        else:
            sorted_models = sorted(eligible, key=lambda m: (m.cost_per_1k_tokens, m.p95_latency_ms))

        return sorted_models[:3]

    def record_fallback(self, from_model: str, to_model: str, reason: str, task_type: str) -> FallbackEvent:
        """Record fallback event in audit trail for reproducibility (§22)."""
        event = FallbackEvent(
            from_model=from_model,
            to_model=to_model,
            reason=reason,
            task_type=task_type,
        )
        self.fallback_audit_trail.append(event)
        logger.warning(
            "Model fallback executed",
            extra={
                "from_model": from_model,
                "to_model": to_model,
                "reason": reason,
                "task_type": task_type,
            },
        )
        return event
