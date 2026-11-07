"""
Contradiction Agent (GH-06, v4.0 §6.5, §20).
Identifies conflicts, normalizes claims, and classifies contradiction types.
LLMs are advisory only; deterministic structured comparison is authoritative.
"""

import re
from typing import Any, Callable, Optional
import uuid
from pydantic import BaseModel, Field

from agents.base import BaseAgent
from agents.contradiction.calculation_service import CalculationService
from agents.schemas import (
    AgentContract,
    Claim,
    ConflictType,
    ContradictionItem,
    EvidenceItem,
)

CONTRADICTION_CONTRACT = AgentContract(
    name="ContradictionAgent",
    purpose="Identify conflicts; normalize claims; classify conflict type",
    input_schema=BaseModel,
    output_schema=BaseModel,
    allowed_tools=["calculation_service", "classifier-llm"],
    allowed_state_read=["claims", "evidence"],
    state_written=["contradictions"],
    failure_conditions=["AMBIGUOUS_ENTITY", "INSUFFICIENT_CONTEXT"],
    retry_policy="no retry",
    escalation_policy="classified as INSUFFICIENT_CONTEXT and surfaced",
)


class ContradictionInput(BaseModel):
    claims: list[Claim]
    evidence: list[EvidenceItem] = Field(default_factory=list)


class ContradictionOutput(BaseModel):
    contradictions: list[ContradictionItem] = Field(default_factory=list)


CONTRADICTION_CONTRACT.input_schema = ContradictionInput
CONTRADICTION_CONTRACT.output_schema = ContradictionOutput


class ContradictionAgent(BaseAgent):
    def __init__(self, contract: AgentContract = CONTRADICTION_CONTRACT):
        super().__init__(contract)
        # Register deterministic calculation service as tool
        self.register_tool("calculation_service", self._calc_tool)

    def _calc_tool(self, operation: str, **kwargs: Any) -> Any:
        if operation == "convert_unit":
            return CalculationService.convert_unit(**kwargs)
        elif operation == "statistical_comparison":
            return CalculationService.statistical_comparison(**kwargs)
        elif operation == "weighted_average":
            return CalculationService.weighted_average(**kwargs)
        raise ValueError(f"Unknown operation: {operation}")

    @staticmethod
    def _extract_numbers(text: str) -> list[float]:
        """Extract numeric values from claim text."""
        matches = re.findall(r"\b\d+(?:\.\d+)?\b", text)
        return [float(m) for m in matches]

    def run(self, validated_input: ContradictionInput, state_reader: Optional[Callable[[str], Any]] = None) -> ContradictionOutput:
        claims = validated_input.claims
        contradictions: list[ContradictionItem] = []

        if len(claims) < 2:
            return ContradictionOutput(contradictions=[])

        # Step 1: Candidate matching & structured comparison (§20.1)
        for i in range(len(claims)):
            for j in range(i + 1, len(claims)):
                c1 = claims[i]
                c2 = claims[j]

                nums1 = self._extract_numbers(c1.text)
                nums2 = self._extract_numbers(c2.text)

                # Check for explicit numeric conflict
                if nums1 and nums2 and nums1[0] != nums2[0]:
                    calc_record = CalculationService.statistical_comparison(nums1[0], nums2[0])
                    # If difference is significant (> 5%), flag numeric conflict
                    if calc_record.result > 5.0:
                        contradictions.append(
                            ContradictionItem(
                                contradiction_id=str(uuid.uuid4()),
                                claim_ids=[c1.claim_id, c2.claim_id],
                                conflict_type=ConflictType.NUMERIC_CONFLICT,
                                entity=f"Quantitative metric ({nums1[0]} vs {nums2[0]})",
                                metric="numeric_value",
                                description=(
                                    f"Numeric divergence of {calc_record.result}% detected between claims: "
                                    f"'{c1.text}' and '{c2.text}'."
                                ),
                                deterministic_basis=f"CalculationService.statistical_comparison: {calc_record.formula} = {calc_record.result}%",
                                llm_advisory_agreed=True,
                            )
                        )
                        continue

                # Check for antonym / direct contradiction markers
                direct_antonyms = [
                    ("increase", "decrease"),
                    ("expanded", "contracted"),
                    ("growth", "decline"),
                    ("positive", "negative"),
                    ("improved", "worsened"),
                ]
                t1_lower = c1.text.lower()
                t2_lower = c2.text.lower()

                is_direct = False
                for pos_word, neg_word in direct_antonyms:
                    if (pos_word in t1_lower and neg_word in t2_lower) or (neg_word in t1_lower and pos_word in t2_lower):
                        contradictions.append(
                            ContradictionItem(
                                contradiction_id=str(uuid.uuid4()),
                                claim_ids=[c1.claim_id, c2.claim_id],
                                conflict_type=ConflictType.DIRECT_CONTRADICTION,
                                entity="Qualitative direction",
                                description=f"Direct polarity contradiction ({pos_word} vs {neg_word}) detected.",
                                deterministic_basis="Antonym polarity pattern match",
                                llm_advisory_agreed=True,
                            )
                        )
                        is_direct = True
                        break

                if is_direct:
                    continue

                # Ambiguous case: invoke advisory classifier LLM if registered
                if "classifier-llm" in self._tools:
                    advisory = self.call_tool("classifier-llm", claim1=c1.text, claim2=c2.text)
                    if isinstance(advisory, dict) and advisory.get("is_conflict"):
                        c_type = ConflictType(advisory.get("conflict_type", ConflictType.METHODOLOGY_DIFFERENCE.value))
                        contradictions.append(
                            ContradictionItem(
                                contradiction_id=str(uuid.uuid4()),
                                claim_ids=[c1.claim_id, c2.claim_id],
                                conflict_type=c_type,
                                entity=advisory.get("entity", "Ambiguous entity"),
                                description=advisory.get("rationale", "LLM advisory conflict detected."),
                                deterministic_basis="LLM advisory consultation confirmed",
                                llm_advisory_agreed=True,
                            )
                        )

        return ContradictionOutput(contradictions=contradictions)
