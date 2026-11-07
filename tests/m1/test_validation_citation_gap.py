"""
Citation gaps are judged per claim (§23): one cited claim must not let
other supported-but-uncited claims through validation.
"""

from agents.schemas import CitationItem, Claim, EvidenceItem, ReportDraft, ReportSection
from agents.validation import ValidationAgent, ValidationInput


def _report(citations):
    return ReportDraft(
        title="Report",
        executive_summary="An executive summary long enough to pass formatting checks.",
        sections=[
            ReportSection(title="Executive Summary", content="Summary"),
            ReportSection(title="Key Findings & Synthesis", content="Synthesis"),
            ReportSection(title="Evidence & Citations", content="Evidence"),
            ReportSection(title="Contradictions & Divergences", content="Contradictions"),
        ],
        citations=citations,
    )


def _evidence(eid):
    return EvidenceItem(
        evidence_id=eid,
        document_chunk_id=f"chk-{eid}",
        source_version_id="s1",
        document_version_id="d1",
        excerpt="Excerpt",
        evidence_hash=f"h-{eid}",
    )


def _citation(claim_id, eid):
    return CitationItem(
        claim_id=claim_id,
        evidence_id=eid,
        source_version_id="s1",
        document_version_id="d1",
        document_chunk_id=f"chk-{eid}",
        excerpt="Excerpt",
    )


def test_supported_claim_without_citation_fails_validation():
    claims = [
        Claim(claim_id="c1", text="Cited claim", is_supported=True, evidence_ids=["ev-1"]),
        Claim(claim_id="c2", text="Supported but never cited", is_supported=True, evidence_ids=["ev-2"]),
    ]
    result = ValidationAgent().execute(
        ValidationInput(
            report_draft=_report([_citation("c1", "ev-1")]),
            evidence=[_evidence("ev-1"), _evidence("ev-2")],
            claims=claims,
        )
    )
    assert result.is_valid is False
    assert "CITATION_GAP" in result.failing_checks
    assert any("c2" in r or "Supported but never cited" in r for r in result.reasons)


def test_every_claim_cited_passes():
    claims = [
        Claim(claim_id="c1", text="One", is_supported=True, evidence_ids=["ev-1"]),
        Claim(claim_id="c2", text="Two", is_supported=True, evidence_ids=["ev-2"]),
    ]
    result = ValidationAgent().execute(
        ValidationInput(
            report_draft=_report([_citation("c1", "ev-1"), _citation("c2", "ev-2")]),
            evidence=[_evidence("ev-1"), _evidence("ev-2")],
            claims=claims,
        )
    )
    assert result.is_valid is True, result.reasons


def test_report_contradiction_section_does_not_overstate_resolution():
    from agents.report.agent import ReportAgent, ReportInput
    from agents.schemas import AnalysisObject

    out = ReportAgent().execute(
        ReportInput(
            title="T",
            analysis_object=AnalysisObject(summary="Summary of findings.", contradictions_addressed=["x1", "x2"]),
            claims=[],
            evidence=[],
        )
    )
    section = next(s for s in out.report_draft.sections if s.title == "Contradictions & Divergences")
    assert "All reconciled with deterministic calculation" not in section.content
