"""
Version-Controlled Prompt Registry (GH-16, v4.0 §22.1).
Enforces status lifecycle: DRAFT -> ACTIVE -> DEPRECATED.
Guarantees version pinning per research run for historical report reproducibility.
"""

from datetime import datetime, timezone
from enum import Enum
import logging
from typing import Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("m1.prompts")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PromptStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    DEPRECATED = "DEPRECATED"


class PromptVersion(BaseModel):
    """
    Representation of prompt_versions entity (§11, §22.1).
    """
    prompt_id: str
    version: str
    template: str
    variables_schema: dict[str, str] = Field(default_factory=dict)
    model_configuration: dict[str, Any] = Field(default_factory=dict)
    created_by: str = "system"
    created_at: datetime = Field(default_factory=utc_now)
    status: PromptStatus = PromptStatus.DRAFT

    def render(self, **kwargs: Any) -> str:
        """Render template with variable validation."""
        for var_name, expected_type in self.variables_schema.items():
            if var_name not in kwargs:
                raise ValueError(f"Missing required template variable: '{var_name}'")
        return self.template.format(**kwargs)


class PromptRegistry:
    """
    In-memory / M3 boundary Prompt Registry.
    Guarantees only ACTIVE prompts are dispatched to new runs,
    while historical runs can fetch DEPRECATED versions for reproducibility.
    """

    def __init__(self):
        # prompt_id -> {version_str: PromptVersion}
        self._versions: dict[str, dict[str, PromptVersion]] = {}
        # prompt_id -> active_version_str
        self._active_versions: dict[str, str] = {}
        self._load_default_templates()

    def register_version(self, prompt_version: PromptVersion) -> None:
        """Register a new prompt version (defaults to DRAFT)."""
        pid = prompt_version.prompt_id
        ver = prompt_version.version

        if pid not in self._versions:
            self._versions[pid] = {}

        if ver in self._versions[pid]:
            raise ValueError(f"Version '{ver}' already exists for prompt '{pid}'. Prompts are immutable.")

        if prompt_version.status == PromptStatus.ACTIVE:
            if pid in self._active_versions:
                prev_ver = self._active_versions[pid]
                self._versions[pid][prev_ver].status = PromptStatus.DEPRECATED
            self._active_versions[pid] = ver
        self._versions[pid][ver] = prompt_version

    def set_status(self, prompt_id: str, version: str, new_status: PromptStatus) -> PromptVersion:
        """Transition version lifecycle (DRAFT -> ACTIVE -> DEPRECATED)."""
        if prompt_id not in self._versions or version not in self._versions[prompt_id]:
            raise KeyError(f"Prompt '{prompt_id}' version '{version}' not found.")

        pv = self._versions[prompt_id][version]
        old_status = pv.status
        pv.status = new_status

        if new_status == PromptStatus.ACTIVE:
            # Deprecate previous active version if any
            if prompt_id in self._active_versions and self._active_versions[prompt_id] != version:
                prev_ver = self._active_versions[prompt_id]
                self._versions[prompt_id][prev_ver].status = PromptStatus.DEPRECATED
            self._active_versions[prompt_id] = version
        elif new_status == PromptStatus.DEPRECATED and self._active_versions.get(prompt_id) == version:
            del self._active_versions[prompt_id]

        logger.info(
            "Prompt status changed",
            extra={"prompt_id": prompt_id, "version": version, "from": old_status.value, "to": new_status.value},
        )
        return pv

    def get_active(self, prompt_id: str) -> PromptVersion:
        """Retrieve ACTIVE version for new production runs."""
        active_ver = self._active_versions.get(prompt_id)
        if not active_ver or active_ver not in self._versions[prompt_id]:
            raise ValueError(f"No ACTIVE prompt version found for prompt '{prompt_id}'.")
        return self._versions[prompt_id][active_ver]

    def get_version(self, prompt_id: str, version: str) -> PromptVersion:
        """Fetch exact version (even if DEPRECATED) for reproducibility (§22.1)."""
        if prompt_id not in self._versions or version not in self._versions[prompt_id]:
            raise KeyError(f"Prompt '{prompt_id}' version '{version}' not found.")
        return self._versions[prompt_id][version]

    def _load_default_templates(self) -> None:
        """Load baseline v1.0 active prompts for research agents."""
        defaults = [
            PromptVersion(
                prompt_id="planner_decompose",
                version="v1.0",
                template="Decompose the research question: '{question}'. Project context: {context}",
                variables_schema={"question": "str", "context": "dict"},
                status=PromptStatus.ACTIVE,
            ),
            PromptVersion(
                prompt_id="evidence_extract",
                version="v1.0",
                template="Extract empirical evidence supporting claims from chunks:\n{chunks}\nDraft claims:\n{claims}",
                variables_schema={"chunks": "list", "claims": "list"},
                status=PromptStatus.ACTIVE,
            ),
            PromptVersion(
                prompt_id="contradiction_classify",
                version="v1.0",
                template="Analyze potential conflicts between Claim 1: '{claim1}' and Claim 2: '{claim2}'",
                variables_schema={"claim1": "str", "claim2": "str"},
                status=PromptStatus.ACTIVE,
            ),
            PromptVersion(
                prompt_id="report_synthesize",
                version="v1.0",
                template="Synthesize final research report for topic '{topic}'. Findings: {findings}",
                variables_schema={"topic": "str", "findings": "list"},
                status=PromptStatus.ACTIVE,
            ),
        ]
        for p in defaults:
            self.register_version(p)
