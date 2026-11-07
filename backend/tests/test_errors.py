from fastapi.testclient import TestClient

from backend.main import app


def test_unknown_route_uses_safe_error_envelope():
    with TestClient(app) as client:
        response = client.get("/route-that-does-not-exist")

    assert response.status_code == 404

    body = response.json()

    assert set(body.keys()) == {"error"}

    error = body["error"]

    assert error["code"] == "NOT_FOUND"
    assert error["message"] == "Resource not found."

    assert isinstance(
        error["requestId"],
        str,
    )
    assert error["requestId"].startswith("req_")
