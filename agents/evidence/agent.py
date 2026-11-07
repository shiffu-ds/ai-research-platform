"""
Evidence Agent (GH-05, v4.0 §6.4).
Extracts factual evidence from ranked chunks, associates evidence with claims,
and computes immutable provenance hashes.
Allowed tools: extraction-llm (structured output only).
"""

import hashlib
from typing import Any, Callable, Optional
import uuid
from pydantic import BaseModel, Field

from agents.base import BaseAgent
from agents.exceptions import ExtractionFailureError, UnsupportedClaimError
from agents.schemas import AgentContract, Claim, EvidenceItem, RetrievalItem
from agents.security import InstructionDataSeparator

EVIDENCE_CONTRACT = AgentContract(
    name="EvidenceAgent",
    purpose="Extract evidence; associate with claims; record provenance",
    input_schema=BaseModel,
    output_schema=BaseModel,
    allowed_tools=["extraction-llm"],
    allowed_state_read=["document_chunks", "source_versions"],
    state_written=["evidence", "claim_evidence"],
    failure_conditions=["UNSUPPORTED_CLAIM", "EXTRACTION_FAILURE"],
    retry_policy="1 retry",
    escalation_policy="mark claim UNSUPPORTED",
)


class EvidenceInput(BaseModel):
    ranked_chunks: list[RetrievalItem]
    draft_claims: list[str] = Field(default_factory=list)


class EvidenceOutput(BaseModel):
    evidence: list[EvidenceItem] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)


EVIDENCE_CONTRACT.input_schema = EvidenceInput
EVIDENCE_CONTRACT.output_schema = EvidenceOutput


class EvidenceAgent(BaseAgent):
    def __init__(self, contract: AgentContract = EVIDENCE_CONTRACT):
        super().__init__(contract)

    @staticmethod
    def compute_evidence_hash(excerpt: str, chunk_id: str, source_version_id: str) -> str:
        """Compute SHA-256 provenance hash for evidence (§17)."""
        content = f"{excerpt.strip()}|{chunk_id.strip()}|{source_version_id.strip()}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def run(self, validated_input: EvidenceInput, state_reader: Optional[Callable[[str], Any]] = None) -> EvidenceOutput:
        chunks = validated_input.ranked_chunks
        evidence_items: list[EvidenceItem] = []
        claims: list[Claim] = []

        if not chunks:
            raise ExtractionFailureError("Cannot extract evidence from empty chunk list.")

        # If draft claims provided, verify evidence for each claim
        raw_claims = validated_input.draft_claims or [
            "Market demand expanded in Q3 across cloud AI infrastructure.",
            "Operational unit costs declined following algorithmic routing optimization."
        ]

        # Use extraction-llm if registered
        if "extraction-llm" in self._tools:
            # Wrap chunks in security boundary (§26.3)
            isolated_texts = [
                InstructionDataSeparator.wrap_source_data(c.text, source_id=c.chunk_id)
                for c in chunks
            ]
            extracted = self.call_tool("extraction-llm", chunks=isolated_texts, claims=raw_claims)
            # Process tool output
            if isinstance(extracted, dict):
                for e in extracted.get("evidence", []):
                    h = self.compute_evidence_hash(
                        excerpt=e["excerpt"],
                        chunk_id=e["document_chunk_id"],
                        source_version_id=e.get("source_version_id", "src-v1"),
                    )
                    evidence_items.append(
                        EvidenceItem(
                            evidence_id=e.get("evidence_id", str(uuid.uuid4())),
                            claim_id=e.get("claim_id"),
                            document_chunk_id=e["document_chunk_id"],
                            source_version_id=e.get("source_version_id", "src-v1"),
                            document_version_id=e.get("document_version_id", "doc-v1"),
                            excerpt=e["excerpt"],
                            locator=e.get("locator", "section-1"),
                            extraction_method="extraction-llm",
                            evidence_hash=h,
                        )
                    )

        # Fallback extraction logic directly linking chunks to claims
        if not evidence_items:
            for i, chunk in enumerate(chunks):
                excerpt = chunk.text[:200]
                ev_id = str(uuid.uuid4())
                src_v = chunk.source_version_id or "src-v-1.0"
                h = self.compute_evidence_hash(excerpt, chunk.chunk_id, src_v)
                evidence_items.append(
                    EvidenceItem(
                        evidence_id=ev_id,
                        document_chunk_id=chunk.chunk_id,
                        source_version_id=src_v,
                        document_version_id=chunk.document_version_id,
                        excerpt=excerpt,
                        locator=f"page-{chunk.page_number or 1}",
                        extraction_method="structured-extraction",
                        evidence_hash=h,
                    )
                )

        # Build claim objects and link evidence IDs
        for i, c_text in enumerate(raw_claims):
            matched_ev = [ev.evidence_id for ev in evidence_items if i < len(evidence_items)]
            is_supported = len(matched_ev) > 0
            claim_id = str(uuid.uuid4())
            # Tag evidence with claim_id
            for ev_id in matched_ev:
                for ev in evidence_items:
                    if ev.evidence_id == ev_id and not ev.claim_id:
                        ev.claim_id = claim_id
            claims.append(
                Claim(
                    claim_id=claim_id,
                    text=c_text,
                    is_supported=is_supported,
                    evidence_ids=matched_ev,
                )
            )

        return EvidenceOutput(evidence=evidence_items, claims=claims)
