from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from backend.db import engine
from backend.redis_client import redis_client


router = APIRouter(
    prefix="/health",
    tags=["health"],
)


@router.get("/live")
def liveness():
    return {
        "status": "alive",
    }


def check_postgresql() -> str:
    if engine is None:
        return "not_configured"

    try:
        with engine.connect() as connection:
            connection.execute(
                text("SELECT 1")
            )

        return "ok"

    except Exception:
        return "unavailable"


def check_redis() -> str:
    if redis_client is None:
        return "not_configured"

    try:
        redis_client.ping()
        return "ok"

    except Exception:
        return "unavailable"


@router.get("/ready")
def readiness():
    checks = {
        "postgresql": check_postgresql(),
        "redis": check_redis(),
    }

    ready = all(
        value == "ok"
        for value in checks.values()
    )

    body = {
        "status": (
            "ready"
            if ready
            else "not_ready"
        ),
        "checks": checks,
    }

    return JSONResponse(
        status_code=200 if ready else 503,
        content=body,
    )
