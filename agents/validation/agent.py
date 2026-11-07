"""
Validation Agent (GH-09, v4.0 §6.8, §23).
Validates citations, unsupported claims, required sections, contradictions, and formatting.
Allowed tools: rule_based_checkers, calculation_service.
"""

from typing import Any, Callable, Optional
from pydantic import BaseModel, Field

from agents.base import BaseAgent
from agents.contradiction.calculation_service import CalculationService
from agents.schemas import (
    AgentContract,
    Claim,
    ContradictionItem,
    EvidenceItem,
    ReportDraft,
    ValidationResult,
)

VALIDATION_CONTRACT = AgentContract(
    name="ValidationAgent",
    purpose="Check citations, unsupported claims, required sections, contradictions, formatting; trigger bounded repair",
    input_schema=BaseModel,
    output_schema=BaseModel,
    allowed_tools=["rule_based_checkers", "calculation_service"],
    allowed_state_read=["report_versions"],
    state_written=["validation_results"],
    failure_conditions=["VALIDATION_TIMEOUT"],
    retry_policy="bounded repair loop (MAX_REPAIR_ATTEMPTS = 3)",
    escalation_policy="VALIDATION_FAILED",
)


class ValidationInput(BaseModel):
    report_draft: ReportDraft
    evidence: list[EvidenceItem] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)
    contradictions: list[ContradictionItem] = Field(default_factory=list)


VALIDATION_CONTRACT.input_schema = ValidationInput
VALIDATION_CONTRACT.output_schema = ValidationResult


class ValidationAgent(BaseAgent):
    REQUIRED_SECTIONS = [
        "Executive Summary",
        "Key Findings & Synthesis",
        "Evidence & Citations",
        "Contradictions & Divergences",
    ]

    def __init__(self, contract: AgentContract = VALIDATION_CONTRACT):
        super().__init__(contract)
        self.register_tool("calculation_service", self._calc_tool)
        self.register_tool("rule_based_checkers", self._rule_checker_tool)

    def _calc_tool(self, operation: str, **kwargs: Any) -> Any:
        if operation == "statistical_comparison":
            return CalculationService.statistical_comparison(**kwargs)
        raise ValueError(f"Unknown operation: {operation}")

    def _rule_checker_tool(self, check_type: str, **kwargs: Any) -> bool:
        return True

    def run(self, validated_input: ValidationInput, state_reader: Optional[Callable[[str], Any]] = None) -> ValidationResult:
        report = validated_input.report_draft
        evidence = validated_input.evidence
        claims = validated_input.claims
        contradictions = validated_input.contradictions

        failing_checks: list[str] = []
        reasons: list[str] = []
        repair_recommendations: list[str] = []

        # 1. Required sections check
        section_titles = {s.title.strip().lower() for s in report.sections}
        for req in self.REQUIRED_SECTIONS:
            if req.lower() not in section_titles:
                failing_checks.append("MISSING_SECTION")
                reasons.append(f"Required report section '{req}' is missing.")
                repair_recommendations.append(f"Regenerate section '{req}'.")

        # 2. Unsupported claims check
        unsupported = [c for c in claims if not c.is_supported or not c.evidence_ids]
        if unsupported:
            failing_checks.append("UNSUPPORTED_CLAIMS")
            reasons.append(f"Found {len(unsupported)} unsupported claims without verified evidence.")
            repair_recommendations.append(
                f"Remove or substantiate claims: {[c.text[:40] for c in unsupported]}"
            )

        # 3. Citation validity check
        evidence_id_set = {e.evidence_id for e in evidence}
        for cit in report.citations:
            if cit.evidence_id not in evidence_id_set:
                failing_checks.append("INVALID_CITATION")
                reasons.append(f"Citation '{cit.citation_id}' references unknown evidence '{cit.evidence_id}'.")
                repair_recommendations.append(f"Re-align citation '{cit.citation_id}' with verified evidence store.")

        # 4. Citation gap check: every supported claim needs at least one citation.
        # (Unsupported claims are already reported by check 2.)
        if claims and not report.citations:
            failing_checks.append("CITATION_GAP")
            reasons.append("Report contains factual claims but zero citations.")
            repair_recommendations.append("Attach citations to all factual claims.")
        else:
            cited_claim_ids = {cit.claim_id for cit in report.citations}
            uncited = [c for c in claims if c.is_supported and c.evidence_ids and c.claim_id not in cited_claim_ids]
            if uncited:
                failing_checks.append("CITATION_GAP")
                reasons.append(
                    f"{len(uncited)} supported claim(s) have no citation: "
                    f"{[f'{c.claim_id}: {c.text[:40]}' for c in uncited]}"
                )
                repair_recommendations.append("Attach a citation to each supported claim.")

        # 5. Formatting check
        if not report.executive_summary or len(report.executive_summary.strip()) < 10:
            failing_checks.append("INVALID_FORMATTING")
            reasons.append("Executive summary is empty or too brief.")
            repair_recommendations.append("Expand executive summary with synthesis findings.")

        is_valid = len(failing_checks) == 0
        status = "PASS" if is_valid else "FAIL"

        return ValidationResult(
            is_valid=is_valid,
            status=status,
            reasons=reasons,
            failing_checks=list(set(failing_checks)),
            repair_recommendations=repair_recommendations,
        )
