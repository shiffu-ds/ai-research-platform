import json
import logging

from fastapi.testclient import TestClient

from backend.main import app
from backend.middleware.logging import StructuredJSONFormatter


def test_structured_formatter_outputs_required_fields():
    formatter = StructuredJSONFormatter()

    record = logging.LogRecord(
        name="backend",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="request completed",
        args=(),
        exc_info=None,
    )

    record.event = "http_request_completed"
    record.request_id = "req_test123"

    payload = json.loads(
        formatter.format(record)
    )

    assert payload["service"] == "m3-backend"
    assert payload["severity"] == "INFO"
    assert payload["event"] == "http_request_completed"
    assert payload["request_id"] == "req_test123"

    assert "timestamp" in payload
    assert "trace_id" in payload
    assert "run_id" in payload
    assert "user_id" in payload
    assert "project_id" in payload
    assert "celery_task_id" in payload
    assert "stage" in payload
    assert "agent" in payload
    assert "retry_count" in payload
    assert "attempt_count" in payload
    assert "error_code" in payload


def test_http_request_generates_correlated_log(caplog):
    caplog.set_level(
        logging.INFO,
        logger="backend.http",
    )

    with TestClient(app) as client:
        response = client.get("/health/live")

    request_id = response.headers["X-Request-ID"]

    matching_records = [
        record
        for record in caplog.records
        if getattr(
            record,
            "event",
            None,
        ) == "http_request_completed"
    ]

    assert matching_records

    record = matching_records[-1]

    assert record.request_id == request_id
    assert record.method == "GET"
    assert record.path == "/health/live"
    assert record.status_code == 200
