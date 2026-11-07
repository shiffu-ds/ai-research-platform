"""
Research Planner Agent schemas (GH-02, v4.0 §6.1).
"""

from typing import Any, Optional
from pydantic import BaseModel, Field

from agents.schemas import ResearchPlan


class PlannerInput(BaseModel):
    research_question: str
    project_context: dict[str, Any] = Field(default_factory=dict)
    prior_plans: list[dict[str, Any]] = Field(default_factory=list)


class PlannerOutput(BaseModel):
    research_plan: ResearchPlan
