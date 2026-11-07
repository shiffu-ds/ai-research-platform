"""
Pytest fixtures and environment setup for M1 test suite.
"""

from pathlib import Path
import sys
from typing import Any
import pytest

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))


class MockRedis:
    """In-memory mock for Redis client supporting SETNX, GET, SET, DELETE."""

    def __init__(self):
        self._data: dict[str, Any] = {}

    def set(self, key: str, val: Any, ex: int = 0, nx: bool = False) -> bool:
        if nx and key in self._data:
            return False
        self._data[key] = val
        return True

    def get(self, key: str) -> Any:
        return self._data.get(key)

    def delete(self, key: str) -> None:
        self._data.pop(key, None)


@pytest.fixture
def mock_redis():
    return MockRedis()
