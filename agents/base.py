"""
Foundational BaseAgent implementation with contract enforcement (GH-01, v4.0 §6).
"""

from abc import ABC, abstractmethod
import logging
from typing import Any, Callable, Optional
from pydantic import BaseModel, ValidationError

from agents.exceptions import (
    AgentContractViolationError,
    SchemaValidationError,
    UnauthorizedStateAccessError,
    UnauthorizedToolError,
)
from agents.schemas import AgentContract

logger = logging.getLogger("m1.agent")


class BaseAgent(ABC):
    """
    Abstract Base Class enforcing the formal Agent Contract (§6).
    Ensures:
      1. Tools called are strictly within contract.allowed_tools.
      2. State keys read/written are strictly authorized.
      3. Input and output schemas match contract specification.
      4. Exceptions map to documented failure codes and escalation paths.
    """

    def __init__(self, contract: AgentContract):
        self.contract = contract
        self._tools: dict[str, Callable[..., Any]] = {}

    def register_tool(self, name: str, func: Callable[..., Any]) -> None:
        """Register a tool callable if permitted by contract."""
        if name not in self.contract.allowed_tools:
            raise UnauthorizedToolError(self.contract.name, name)
        self._tools[name] = func

    def call_tool(self, tool_name: str, **kwargs: Any) -> Any:
        """Execute a tool while enforcing the tool allowlist."""
        if tool_name not in self.contract.allowed_tools:
            logger.error(
                "Security violation: unauthorized tool call",
                extra={"agent": self.contract.name, "tool": tool_name},
            )
            raise UnauthorizedToolError(self.contract.name, tool_name)
        if tool_name not in self._tools:
            raise AgentContractViolationError(
                f"Tool '{tool_name}' is authorized in contract for '{self.contract.name}' but has no registered implementation."
            )
        return self._tools[tool_name](**kwargs)

    def validate_state_read(self, key: str) -> None:
        """Validate that the agent is authorized to read the given state key."""
        if key not in self.contract.allowed_state_read:
            raise UnauthorizedStateAccessError(self.contract.name, key, access_type="read")

    def validate_state_write(self, key: str) -> None:
        """Validate that the agent is authorized to write the given state key."""
        if key not in self.contract.state_written:
            raise UnauthorizedStateAccessError(self.contract.name, key, access_type="write")

    def validate_input(self, data: Any) -> BaseModel:
        """Validate raw input against the contract input schema."""
        if isinstance(data, self.contract.input_schema):
            return data
        try:
            if isinstance(data, dict):
                return self.contract.input_schema(**data)
            return self.contract.input_schema.model_validate(data)
        except ValidationError as e:
            raise SchemaValidationError(
                f"Input to '{self.contract.name}' violated schema: {e}",
                details={"errors": e.errors(), "agent": self.contract.name},
            )

    def validate_output(self, data: Any) -> BaseModel:
        """Validate raw output against the contract output schema."""
        if isinstance(data, self.contract.output_schema):
            return data
        try:
            if isinstance(data, dict):
                return self.contract.output_schema(**data)
            return self.contract.output_schema.model_validate(data)
        except ValidationError as e:
            raise SchemaValidationError(
                f"Output from '{self.contract.name}' violated schema: {e}",
                details={"errors": e.errors(), "agent": self.contract.name},
            )

    @abstractmethod
    def run(self, validated_input: BaseModel, state_reader: Optional[Callable[[str], Any]] = None) -> BaseModel:
        """Core execution logic of the agent."""
        pass

    def execute(self, raw_input: Any, state_reader: Optional[Callable[[str], Any]] = None) -> BaseModel:
        """Safe execution wrapper with full contract enforcement."""
        logger.info(
            "Agent execution initiated",
            extra={"agent": self.contract.name, "purpose": self.contract.purpose},
        )
        validated_in = self.validate_input(raw_input)
        raw_out = self.run(validated_in, state_reader=state_reader)
        validated_out = self.validate_output(raw_out)
        logger.info("Agent execution completed successfully", extra={"agent": self.contract.name})
        return validated_out
