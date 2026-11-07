"""
Tests for Model Routing and Prompt Registry (GH-15, GH-16, v4.0 §22, §22.1).
"""

import pytest

from agents.prompts import PromptRegistry, PromptStatus, PromptVersion
from agents.routing import ModelConfig, ModelRouter


# --- GH-15: Model Router & Fallback Tests ---
def test_model_router_selection_and_fallback():
    router = ModelRouter()

    # Route chain for planning task (requires high/frontier quality)
    chain = router.select_route_chain(
        task_type="planning",
        required_quality="frontier",
        context_needed=10000,
    )
    assert len(chain) >= 1
    assert chain[0].quality_tier == "frontier"

    # Fallback recording audit trail (§22)
    event = router.record_fallback(
        from_model="gemini-1.5-pro-v1",
        to_model="gpt-4o-v1",
        reason="RATE_LIMIT",
        task_type="planning",
    )
    assert event.from_model == "gemini-1.5-pro-v1"
    assert event.to_model == "gpt-4o-v1"
    assert event.reason == "RATE_LIMIT"
    assert len(router.fallback_audit_trail) == 1


# --- GH-16: Prompt Registry Lifecycle Tests ---
def test_prompt_registry_lifecycle():
    registry = PromptRegistry()

    # Create new draft prompt
    p_v1 = PromptVersion(
        prompt_id="custom_analysis",
        version="v1.0",
        template="Analyze subject: {subject}",
        variables_schema={"subject": "str"},
        status=PromptStatus.DRAFT,
    )
    registry.register_version(p_v1)

    # DRAFT prompt cannot be fetched as active for production run
    with pytest.raises(ValueError):
        registry.get_active("custom_analysis")

    # Transition to ACTIVE
    registry.set_status("custom_analysis", "v1.0", PromptStatus.ACTIVE)
    active_prompt = registry.get_active("custom_analysis")
    assert active_prompt.version == "v1.0"
    assert active_prompt.render(subject="AI Safety") == "Analyze subject: AI Safety"

    # Register v2.0 as ACTIVE -> v1.0 automatically transitions to DEPRECATED
    p_v2 = PromptVersion(
        prompt_id="custom_analysis",
        version="v2.0",
        template="Advanced analysis on: {subject}",
        variables_schema={"subject": "str"},
        status=PromptStatus.ACTIVE,
    )
    registry.register_version(p_v2)

    assert registry.get_active("custom_analysis").version == "v2.0"
    # Historical reproducibility: v1.0 is still retrievable even when deprecated
    historical = registry.get_version("custom_analysis", "v1.0")
    assert historical.status == PromptStatus.DEPRECATED
