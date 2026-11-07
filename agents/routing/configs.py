"""
Versioned Model Configurations for Dynamic Router (GH-15, v4.0 §22).
"""

from typing import Optional
from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    """
    Versioned model specification (§22).
    """
    model_id: str
    name: str
    provider: str
    version: str
    quality_tier: str  # "frontier", "high", "standard", "economy"
    context_window: int
    cost_per_1k_tokens: float
    p95_latency_ms: int
    supported_task_types: list[str] = Field(default_factory=list)
    is_active: bool = True


# Standard versioned model configurations (§22)
DEFAULT_MODEL_REGISTRY: dict[str, ModelConfig] = {
    "gemini-1.5-pro-v1": ModelConfig(
        model_id="gemini-1.5-pro-v1",
        name="Gemini 1.5 Pro",
        provider="google",
        version="1.5-pro-002",
        quality_tier="frontier",
        context_window=1000000,
        cost_per_1k_tokens=0.0035,
        p95_latency_ms=1200,
        supported_task_types=["planning", "synthesis", "analysis", "report"],
    ),
    "gemini-1.5-flash-v1": ModelConfig(
        model_id="gemini-1.5-flash-v1",
        name="Gemini 1.5 Flash",
        provider="google",
        version="1.5-flash-002",
        quality_tier="high",
        context_window=1000000,
        cost_per_1k_tokens=0.00035,
        p95_latency_ms=450,
        supported_task_types=["discovery", "retrieval", "extraction", "classification"],
    ),
    "gpt-4o-v1": ModelConfig(
        model_id="gpt-4o-v1",
        name="GPT-4o",
        provider="openai",
        version="2024-08-06",
        quality_tier="frontier",
        context_window=128000,
        cost_per_1k_tokens=0.005,
        p95_latency_ms=1100,
        supported_task_types=["planning", "synthesis", "analysis", "report"],
    ),
    "gpt-4o-mini-v1": ModelConfig(
        model_id="gpt-4o-mini-v1",
        name="GPT-4o Mini",
        provider="openai",
        version="2024-07-18",
        quality_tier="high",
        context_window=128000,
        cost_per_1k_tokens=0.0006,
        p95_latency_ms=400,
        supported_task_types=["discovery", "extraction", "classification"],
    ),
    "claude-3-5-sonnet-v1": ModelConfig(
        model_id="claude-3-5-sonnet-v1",
        name="Claude 3.5 Sonnet",
        provider="anthropic",
        version="20240620",
        quality_tier="frontier",
        context_window=200000,
        cost_per_1k_tokens=0.006,
        p95_latency_ms=1400,
        supported_task_types=["synthesis", "analysis", "report"],
    ),
}
