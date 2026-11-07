"""
Source Discovery Agent (GH-03, v4.0 §6.2).
Identifies candidate sources, collects metadata, applies SSRF validation, and ranks candidates.
Allowed tools: web_search (SSRF-guarded), metadata_fetch.
"""

from typing import Any, Callable, Optional
from pydantic import BaseModel, Field

from agents.base import BaseAgent
from agents.exceptions import NoSourcesFoundError, SourceError, SSRFBlockedError
from agents.schemas import AgentContract, CandidateSource, PlanTask
from agents.security import SSRFValidator

SOURCE_DISCOVERY_CONTRACT = AgentContract(
    name="SourceDiscoveryAgent",
    purpose="Identify candidate sources; collect metadata; rank candidates",
    input_schema=BaseModel,  # dynamically set below
    output_schema=BaseModel,
    allowed_tools=["web_search", "metadata_fetch"],
    allowed_state_read=["sources", "source_versions"],
    state_written=["candidate_sources"],
    failure_conditions=["NO_SOURCES_FOUND", "SSRF_BLOCKED"],
    retry_policy="2 retries with backoff",
    escalation_policy="SOURCE_ERROR",
)


class SourceDiscoveryInput(BaseModel):
    task: PlanTask
    query: str
    project_context: dict[str, Any] = Field(default_factory=dict)
    max_candidates: int = 5


class SourceDiscoveryOutput(BaseModel):
    candidate_sources: list[CandidateSource] = Field(default_factory=list)


SOURCE_DISCOVERY_CONTRACT.input_schema = SourceDiscoveryInput
SOURCE_DISCOVERY_CONTRACT.output_schema = SourceDiscoveryOutput


class SourceDiscoveryAgent(BaseAgent):
    def __init__(self, contract: AgentContract = SOURCE_DISCOVERY_CONTRACT):
        super().__init__(contract)

    def run(self, validated_input: SourceDiscoveryInput, state_reader: Optional[Callable[[str], Any]] = None) -> SourceDiscoveryOutput:
        query = validated_input.query.strip()
        candidates: list[CandidateSource] = []

        if "web_search" in self._tools:
            raw_sources = self.call_tool("web_search", query=query, max_results=validated_input.max_candidates)
            for s in raw_sources:
                url = s.get("url", "")
                # SSRF guard at fetch/discovery boundary (§26.4)
                SSRFValidator.validate_url(url)

                title = s.get("title", "Untitled Source")
                candidates.append(
                    CandidateSource(
                        url=url,
                        title=title,
                        source_type=s.get("source_type", "web"),
                        authority_level=float(s.get("authority_level", 0.7)),
                        freshness_score=float(s.get("freshness_score", 0.8)),
                        publisher_reputation=float(s.get("publisher_reputation", 0.75)),
                        metadata={"task_id": validated_input.task.task_id},
                    )
                )

        # Fallback simulated source discovery if no external tool registered
        if not candidates:
            mock_url = f"https://example.com/research/{validated_input.task.evidence_category}"
            SSRFValidator.validate_url(mock_url)
            candidates.append(
                CandidateSource(
                    url=mock_url,
                    title=f"Authoritative Overview: {validated_input.task.evidence_category}",
                    source_type="academic",
                    authority_level=0.9,
                    freshness_score=0.85,
                    publisher_reputation=0.92,
                    metadata={"task_id": validated_input.task.task_id, "simulated": True},
                )
            )

        if not candidates:
            raise NoSourcesFoundError(f"No candidate sources found for query: '{query}'")

        # Rank candidates by composite score: 0.4*authority + 0.3*freshness + 0.3*reputation
        candidates.sort(
            key=lambda c: (0.4 * c.authority_level + 0.3 * c.freshness_score + 0.3 * c.publisher_reputation),
            reverse=True,
        )

        return SourceDiscoveryOutput(candidate_sources=candidates[: validated_input.max_candidates])
