"""
Research Run Idempotency Manager (GH-13, v4.0 §8).
Enforces composite identity hashing and Redis SETNX-style deduplication with 45-minute TTL.
"""

import hashlib
import json
import logging
from typing import Any, Optional

logger = logging.getLogger("m1.idempotency")

MAX_RUN_DURATION_TTL_SECONDS = 45 * 60  # 45 minutes (§8)


def compute_dict_hash(data: dict[str, Any]) -> str:
    """Deterministically compute SHA-256 hash of a dictionary."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class RunIdempotencyIdentity:
    """
    Composite identity schema specified in v4.0 §8:
    run_id, project_id, created_by, configuration_hash,
    prompt_configuration_hash, research_plan_version
    """

    def __init__(
        self,
        run_id: str,
        project_id: str,
        created_by: str,
        configuration: dict[str, Any],
        prompt_versions: dict[str, str],
        research_plan_version: int = 1,
    ):
        self.run_id = run_id
        self.project_id = project_id
        self.created_by = created_by
        self.configuration_hash = compute_dict_hash(configuration)
        self.prompt_configuration_hash = compute_dict_hash(prompt_versions)
        self.research_plan_version = research_plan_version

    @property
    def composite_hash(self) -> str:
        """Single composite SHA-256 signature for the run."""
        raw = (
            f"{self.run_id}:{self.project_id}:{self.created_by}:"
            f"{self.configuration_hash}:{self.prompt_configuration_hash}:{self.research_plan_version}"
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class IdempotencyManager:
    """
    Manages Redis SETNX duplicate-delivery suppression (§8).
    Prevents duplicate evidence, reports, source versions, or notifications.
    """

    def __init__(self, redis_client: Optional[Any] = None, ttl_seconds: int = MAX_RUN_DURATION_TTL_SECONDS):
        self.redis_client = redis_client
        self.ttl_seconds = ttl_seconds
        # In-memory lock fallback for testing or single-process execution
        self._local_locks: set[str] = set()

    def acquire_lock(self, run_id: str) -> bool:
        """
        Attempts to acquire the idempotency lock using SETNX.
        Returns True if acquired (first delivery), False if duplicate delivery.
        """
        lock_key = f"idempotency:run:{run_id}"

        if self.redis_client:
            try:
                # set nx=True, ex=ttl
                acquired = bool(self.redis_client.set(lock_key, "LOCKED", ex=self.ttl_seconds, nx=True))
                if not acquired:
                    logger.warning(
                        "Duplicate delivery suppressed by Redis SETNX lock",
                        extra={"run_id": run_id, "lock_key": lock_key},
                    )
                return acquired
            except Exception as e:
                logger.error(f"Redis idempotency error for {run_id}: {e}")

        # In-memory fallback
        if run_id in self._local_locks:
            logger.warning(
                "Duplicate delivery suppressed by local lock",
                extra={"run_id": run_id},
            )
            return False
        self._local_locks.add(run_id)
        return True

    def release_lock(self, run_id: str) -> None:
        """Releases the lock on terminal completion or cleanup."""
        lock_key = f"idempotency:run:{run_id}"
        if self.redis_client:
            try:
                self.redis_client.delete(lock_key)
            except Exception:
                pass
        self._local_locks.discard(run_id)
