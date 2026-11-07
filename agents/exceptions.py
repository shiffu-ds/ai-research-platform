"""
M1 Exceptions and Error Codes for Autonomous AI Research & Decision Intelligence Platform v4.0.
"""

from typing import Any, Optional


class M1Error(Exception):
    """Base exception for all M1 orchestration errors."""

    def __init__(self, message: str, error_code: str = "ORCHESTRATION_ERROR", details: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}


class AgentContractViolationError(M1Error):
    """Raised when an agent attempts an action that violates its contract specification (§6)."""

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None):
        super().__init__(message, error_code="CONTRACT_VIOLATION", details=details)


class UnauthorizedToolError(AgentContractViolationError):
    """Raised when an agent calls a tool not in its allowed_tools list."""

    def __init__(self, agent_name: str, tool_name: str):
        super().__init__(
            f"Agent '{agent_name}' attempted to invoke unauthorized tool '{tool_name}'.",
            details={"agent_name": agent_name, "tool_name": tool_name, "error_code": "UNAUTHORIZED_TOOL"},
        )
        self.error_code = "UNAUTHORIZED_TOOL"


class UnauthorizedStateAccessError(AgentContractViolationError):
    """Raised when an agent reads/writes a state key outside its declared contract."""

    def __init__(self, agent_name: str, key_name: str, access_type: str = "write"):
        super().__init__(
            f"Agent '{agent_name}' attempted unauthorized {access_type} on state key '{key_name}'.",
            details={"agent_name": agent_name, "key_name": key_name, "access_type": access_type},
        )
        self.error_code = "UNAUTHORIZED_STATE_ACCESS"


class SchemaValidationError(M1Error):
    """Raised when an agent's output or tool input fails schema validation."""

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None):
        super().__init__(message, error_code="VALIDATION_ERROR", details=details)


class SSRFBlockedError(M1Error):
    """Raised when a URL is blocked by the SSRF security boundary (§26.4)."""

    def __init__(self, url: str, reason: str):
        super().__init__(
            f"SSRF blocked request to '{url}': {reason}",
            error_code="SSRF_BLOCKED",
            details={"url": url, "reason": reason},
        )


class PromptInjectionError(M1Error):
    """Raised when prompt injection or untrusted instruction pattern is detected."""

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None):
        super().__init__(message, error_code="SECURITY_ERROR", details=details)


# Agent-specific domain failure classes
class InvalidQuestionError(M1Error):
    """Raised by Research Planner when a question is unprocessable."""

    def __init__(self, reason: str):
        super().__init__(f"Invalid research question: {reason}", error_code="INVALID_QUESTION")


class PlanTimeoutError(M1Error):
    """Raised when planning exceeds latency budget."""

    def __init__(self, message: str = "Planning timed out"):
        super().__init__(message, error_code="PLAN_TIMEOUT")


class NoSourcesFoundError(M1Error):
    """Raised when source discovery finds zero valid sources."""

    def __init__(self, message: str = "No sources found"):
        super().__init__(message, error_code="NO_SOURCES_FOUND")


class SourceError(M1Error):
    """Raised after retry exhaustion during source discovery."""

    def __init__(self, message: str = "Source discovery failed"):
        super().__init__(message, error_code="SOURCE_ERROR")


class RetrievalTimeoutError(M1Error):
    """Raised when retrieval exceeds timeout limit."""

    def __init__(self, message: str = "Retrieval timed out"):
        super().__init__(message, error_code="RETRIEVAL_TIMEOUT")


class EmptyIndexError(M1Error):
    """Raised when index is empty or project has no chunks."""

    def __init__(self, message: str = "Empty chunk index"):
        super().__init__(message, error_code="EMPTY_INDEX")


class RetrievalError(M1Error):
    """Raised when retrieval fails after retry."""

    def __init__(self, message: str = "Retrieval failed"):
        super().__init__(message, error_code="RETRIEVAL_ERROR")


class UnsupportedClaimError(M1Error):
    """Raised when a claim cannot be substantiated by evidence."""

    def __init__(self, claim: str):
        super().__init__(f"Unsupported claim: {claim}", error_code="UNSUPPORTED_CLAIM", details={"claim": claim})


class ExtractionFailureError(M1Error):
    """Raised when structured extraction fails."""

    def __init__(self, message: str = "Extraction failure"):
        super().__init__(message, error_code="EXTRACTION_FAILURE")


class SynthesisTimeoutError(M1Error):
    """Raised when synthesis LLM exceeds time budget."""

    def __init__(self, message: str = "Synthesis timed out"):
        super().__init__(message, error_code="SYNTHESIS_TIMEOUT")


class MissingSectionError(M1Error):
    """Raised when report is missing a required section."""

    def __init__(self, section_name: str):
        super().__init__(f"Missing required section: {section_name}", error_code="MISSING_SECTION", details={"section": section_name})


class CitationGapError(M1Error):
    """Raised when a report claim lacks an attached citation."""

    def __init__(self, claim_id: str):
        super().__init__(f"Citation gap on claim: {claim_id}", error_code="CITATION_GAP", details={"claim_id": claim_id})


class ValidationTimeoutError(M1Error):
    """Raised when validation check exceeds time budget."""

    def __init__(self, message: str = "Validation pass timed out"):
        super().__init__(message, error_code="VALIDATION_TIMEOUT")


class RepairLimitExceededError(M1Error):
    """Raised when MAX_REPAIR_ATTEMPTS (3) is exceeded."""

    def __init__(self, attempts: int, failing_checks: list[str]):
        super().__init__(
            f"Exceeded max repair attempts ({attempts}). Failing checks: {failing_checks}",
            error_code="VALIDATION_FAILED",
            details={"attempts": attempts, "failing_checks": failing_checks},
        )
