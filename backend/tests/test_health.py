from fastapi.testclient import TestClient

from backend.api.v1 import health
from backend.main import app


class FakeConnection:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def execute(self, statement):
        return None


class HealthyEngine:
    def connect(self):
        return FakeConnection()


class HealthyRedis:
    def ping(self):
        return True


class BrokenEngine:
    def connect(self):
        raise RuntimeError("database unavailable")


class BrokenRedis:
    def ping(self):
        raise RuntimeError("redis unavailable")


def test_readiness_is_ready_when_dependencies_are_healthy(monkeypatch):
    monkeypatch.setattr(
        health,
        "engine",
        HealthyEngine(),
    )
    monkeypatch.setattr(
        health,
        "redis_client",
        HealthyRedis(),
    )

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {
            "postgresql": "ok",
            "redis": "ok",
        },
    }


def test_readiness_is_not_ready_when_dependencies_fail(monkeypatch):
    monkeypatch.setattr(
        health,
        "engine",
        BrokenEngine(),
    )
    monkeypatch.setattr(
        health,
        "redis_client",
        BrokenRedis(),
    )

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {
            "postgresql": "unavailable",
            "redis": "unavailable",
        },
    }


def test_readiness_reports_unconfigured_dependencies(monkeypatch):
    monkeypatch.setattr(
        health,
        "engine",
        None,
    )
    monkeypatch.setattr(
        health,
        "redis_client",
        None,
    )

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {
            "postgresql": "not_configured",
            "redis": "not_configured",
        },
    }
