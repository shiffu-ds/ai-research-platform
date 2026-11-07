"""
Tests for Bounded Validation & Repair Loop (GH-17, v4.0 §23).
"""

import pytest

from agents.exceptions import RepairLimitExceededError, ValidationTimeoutError
from agents.schemas import Claim, EvidenceItem, ReportDraft, ReportSection, ValidationResult
from agents.validation import BoundedRepairLoopController, MAX_REPAIR_ATTEMPTS


def test_repair_loop_max_attempts_exhaustion():
    controller = BoundedRepairLoopController(max_attempts=3)

    failing_result = ValidationResult(
        is_valid=False,
        status="FAIL",
        failing_checks=["MISSING_SECTION"],
        reasons=["Missing required section"],
    )

    # Attempt 1, 2, 3 permitted
    for i in range(MAX_REPAIR_ATTEMPTS):
        assert controller.can_attempt_repair(failing_result) is True
        controller.attempts += 1

    # Attempt 4 must raise RepairLimitExceededError
    with pytest.raises(RepairLimitExceededError) as exc_info:
        controller.can_attempt_repair(failing_result)
    assert "Exceeded max repair attempts" in str(exc_info.value)
    assert exc_info.value.error_code == "VALIDATION_FAILED"


def test_repair_loop_execution_fixes_missing_sections():
    controller = BoundedRepairLoopController()
    draft = ReportDraft(
        title="Draft",
        executive_summary="Executive summary content here.",
        sections=[ReportSection(title="Executive Summary", content="Summary content")],
        status="DRAFT",
    )
    val_fail = ValidationResult(
        is_valid=False,
        status="FAIL",
        failing_checks=["MISSING_SECTION"],
    )
    repaired = controller.execute_repair(
        report=draft,
        validation_result=val_fail,
        evidence=[],
        claims=[],
    )
    assert repaired.version == 2
    section_titles = [s.title for s in repaired.sections]
    assert "Key Findings & Synthesis" in section_titles
    assert "Evidence & Citations" in section_titles
