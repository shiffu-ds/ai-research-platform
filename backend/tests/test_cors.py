from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.config import Settings
from backend.main import configure_cors


def _app(origins: str) -> FastAPI:
    app = FastAPI()

    @app.get("/health/live")
    def live():
        return {"status": "alive"}

    configure_cors(app, Settings(_env_file=None, cors_origins=origins))
    return app


def test_origin_list_is_parsed_and_trimmed():
    s = Settings(_env_file=None, cors_origins=" http://localhost:3000/ , https://app.example.org ,")
    assert s.cors_origin_list == ["http://localhost:3000", "https://app.example.org"]
    assert Settings(_env_file=None).cors_origin_list == []


def test_configured_origin_gets_credentialed_cors_headers():
    client = TestClient(_app("http://localhost:3000"))
    pre = client.options(
        "/health/live",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "last-event-id",
        },
    )
    assert pre.status_code == 200
    assert pre.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert pre.headers["access-control-allow-credentials"] == "true"

    res = client.get("/health/live", headers={"Origin": "http://localhost:3000"})
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_unlisted_origin_is_not_allowed():
    client = TestClient(_app("http://localhost:3000"))
    res = client.get("/health/live", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in res.headers


def test_no_origins_means_no_cors():
    client = TestClient(_app(""))
    res = client.get("/health/live", headers={"Origin": "http://localhost:3000"})
    assert "access-control-allow-origin" not in res.headers
