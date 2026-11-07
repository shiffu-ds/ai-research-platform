from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.main import app


def test_app_is_fastapi_application():
    assert isinstance(app, FastAPI)


def test_app_boots_and_exposes_openapi():
    with TestClient(app) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["openapi"]


def test_liveness_endpoint_reports_process_alive():
    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {
        "status": "alive",
    }


def test_readiness_endpoint_exists():
    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code in {200, 503}

    body = response.json()

    assert "status" in body
    assert "checks" in body
    assert "postgresql" in body["checks"]
    assert "redis" in body["checks"]
