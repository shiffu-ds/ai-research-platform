"""
Autonomous AI Research Platform - M1 Agent & Orchestration Layer (v4.0).
"""

from agents.base import BaseAgent
from agents.exceptions import M1Error, AgentContractViolationError, UnauthorizedToolError, UnauthorizedStateAccessError
from agents.schemas import AgentContract, ResearchPlan, CandidateSource, RetrievalItem, EvidenceItem, Claim, ContradictionItem, AnalysisObject, ReportDraft, ValidationResult
from agents.planner import ResearchPlannerAgent
from agents.discovery import SourceDiscoveryAgent
from agents.retrieval import RetrievalAgent
from agents.evidence import EvidenceAgent
from agents.contradiction import ContradictionAgent, CalculationService
from agents.analysis import AnalysisAgent
from agents.report import ReportAgent
from agents.validation import ValidationAgent, BoundedRepairLoopController
from agents.orchestration import ResearchGraphBuilder, ResearchState, ResearchRunLifecycle, RunState, RunIdempotencyIdentity, IdempotencyManager, CheckpointRepository
from agents.routing import ModelRouter, ModelConfig
from agents.prompts import PromptRegistry, PromptVersion, PromptStatus
from agents.evaluation import BenchmarkRunner, EvaluationThresholds

__all__ = [
    "BaseAgent",
    "M1Error",
    "AgentContractViolationError",
    "UnauthorizedToolError",
    "UnauthorizedStateAccessError",
    "AgentContract",
    "ResearchPlan",
    "CandidateSource",
    "RetrievalItem",
    "EvidenceItem",
    "Claim",
    "ContradictionItem",
    "AnalysisObject",
    "ReportDraft",
    "ValidationResult",
    "ResearchPlannerAgent",
    "SourceDiscoveryAgent",
    "RetrievalAgent",
    "EvidenceAgent",
    "ContradictionAgent",
    "CalculationService",
    "AnalysisAgent",
    "ReportAgent",
    "ValidationAgent",
    "BoundedRepairLoopController",
    "ResearchGraphBuilder",
    "ResearchState",
    "ResearchRunLifecycle",
    "RunState",
    "RunIdempotencyIdentity",
    "IdempotencyManager",
    "CheckpointRepository",
    "ModelRouter",
    "ModelConfig",
    "PromptRegistry",
    "PromptVersion",
    "PromptStatus",
    "BenchmarkRunner",
    "EvaluationThresholds",
]
