"""
Report Agent (GH-08, v4.0 §6.7).
Generates evidence-backed report structure, draft report versions, and reproducible citations.
Allowed tools: report-llm (citation-constrained decoding).
"""

from typing import Any, Callable, Optional
import uuid
from pydantic import BaseModel, Field

from agents.base import BaseAgent
from agents.exceptions import CitationGapError, MissingSectionError
from agents.schemas import (
    AgentContract,
    AnalysisObject,
    CitationItem,
    Claim,
    EvidenceItem,
    ReportDraft,
    ReportSection,
)

REPORT_CONTRACT = AgentContract(
    name="ReportAgent",
    purpose="Generate structure; produce evidence-backed claims; attach citations; produce versions",
    input_schema=BaseModel,
    output_schema=BaseModel,
    allowed_tools=["report-llm"],
    allowed_state_read=["evidence", "claims", "prompt_versions"],
    state_written=["report_versions", "report_sections", "citations"],
    failure_conditions=["MISSING_SECTION", "CITATION_GAP"],
    retry_policy="routed to Validation Agent, not self-retried",
    escalation_policy="routed to Validation Agent",
)


class ReportInput(BaseModel):
    analysis_object: AnalysisObject
    prompt_version: str = "prompt-v1.0"
    claims: list[Claim] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    title: str = "Autonomous Intelligence Research Report"


class ReportOutput(BaseModel):
    report_draft: ReportDraft


REPORT_CONTRACT.input_schema = ReportInput
REPORT_CONTRACT.output_schema = ReportOutput


class ReportAgent(BaseAgent):
    REQUIRED_SECTIONS = [
        "Executive Summary",
        "Key Findings & Synthesis",
        "Evidence & Citations",
        "Contradictions & Divergences",
    ]

    def __init__(self, contract: AgentContract = REPORT_CONTRACT):
        super().__init__(contract)

    def run(self, validated_input: ReportInput, state_reader: Optional[Callable[[str], Any]] = None) -> ReportOutput:
        analysis = validated_input.analysis_object
        claims = validated_input.claims
        evidence = validated_input.evidence

        # Build citations mapping evidence to claims (§18)
        citations: list[CitationItem] = []
        for claim in claims:
            for ev_id in claim.evidence_ids:
                matching_ev = next((e for e in evidence if e.evidence_id == ev_id), None)
                if matching_ev:
                    citations.append(
                        CitationItem(
                            citation_id=str(uuid.uuid4()),
                            claim_id=claim.claim_id,
                            evidence_id=matching_ev.evidence_id,
                            source_version_id=matching_ev.source_version_id,
                            document_version_id=matching_ev.document_version_id,
                            document_chunk_id=matching_ev.document_chunk_id,
                            excerpt=matching_ev.excerpt,
                            locator=matching_ev.locator,
                        )
                    )

        # Build required report sections
        sections = [
            ReportSection(
                section_id=str(uuid.uuid4()),
                title="Executive Summary",
                content=analysis.summary,
                claim_ids=[c.claim_id for c in claims],
                citation_ids=[cit.citation_id for cit in citations],
            ),
            ReportSection(
                section_id=str(uuid.uuid4()),
                title="Key Findings & Synthesis",
                content="\n".join([f"- {kf}" for kf in analysis.key_findings]),
                claim_ids=[c.claim_id for c in claims],
                citation_ids=[cit.citation_id for cit in citations],
            ),
            ReportSection(
                section_id=str(uuid.uuid4()),
                title="Evidence & Citations",
                content=f"Report incorporates {len(evidence)} verified evidence provenance records across claims.",
                claim_ids=[c.claim_id for c in claims],
                citation_ids=[cit.citation_id for cit in citations],
            ),
            ReportSection(
                section_id=str(uuid.uuid4()),
                title="Contradictions & Divergences",
                # The report agent doesn't see how each conflict was settled, so it
                # must not claim they were all resolved deterministically.
                content=(
                    f"Examined {len(analysis.contradictions_addressed)} potential contradiction points. "
                    "Each is recorded with how it was handled: deterministic calculation "
                    "where values could be compared, advisory review otherwise."
                    if analysis.contradictions_addressed
                    else "No contradictions between sources were identified."
                ),
                claim_ids=[],
                citation_ids=[],
            ),
        ]

        draft = ReportDraft(
            report_id=str(uuid.uuid4()),
            version=1,
            title=validated_input.title,
            executive_summary=analysis.summary,
            sections=sections,
            citations=citations,
            claims=claims,
            status="DRAFT",
            prompt_version=validated_input.prompt_version,
        )

        return ReportOutput(report_draft=draft)
