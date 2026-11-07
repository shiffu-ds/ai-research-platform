import json
import logging
import sys
import time
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class StructuredJSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(
                record.created,
                tz=timezone.utc,
            ).isoformat(),
            "service": "m3-backend",
            "severity": record.levelname,
            "event": getattr(
                record,
                "event",
                record.getMessage(),
            ),
            "request_id": getattr(
                record,
                "request_id",
                None,
            ),
            "trace_id": getattr(
                record,
                "trace_id",
                None,
            ),
            "run_id": getattr(
                record,
                "run_id",
                None,
            ),
            "user_id": getattr(
                record,
                "user_id",
                None,
            ),
            "project_id": getattr(
                record,
                "project_id",
                None,
            ),
            "celery_task_id": getattr(
                record,
                "celery_task_id",
                None,
            ),
            "stage": getattr(
                record,
                "stage",
                None,
            ),
            "agent": getattr(
                record,
                "agent",
                None,
            ),
            "retry_count": getattr(
                record,
                "retry_count",
                None,
            ),
            "attempt_count": getattr(
                record,
                "attempt_count",
                None,
            ),
            "error_code": getattr(
                record,
                "error_code",
                None,
            ),
        }

        if hasattr(record, "method"):
            payload["method"] = record.method

        if hasattr(record, "path"):
            payload["path"] = record.path

        if hasattr(record, "status_code"):
            payload["status_code"] = record.status_code

        if hasattr(record, "duration_ms"):
            payload["duration_ms"] = record.duration_ms

        return json.dumps(
            payload,
            separators=(",", ":"),
        )


def configure_logging(
    log_level: str = "INFO",
) -> None:
    logger = logging.getLogger("backend")

    logger.setLevel(
        getattr(
            logging,
            log_level.upper(),
            logging.INFO,
        )
    )

    if not any(
        getattr(handler, "_m3_handler", False)
        for handler in logger.handlers
    ):
        handler = logging.StreamHandler(
            sys.stdout
        )

        handler.setFormatter(
            StructuredJSONFormatter()
        )

        handler._m3_handler = True

        logger.addHandler(handler)

    logger.propagate = True


http_logger = logging.getLogger(
    "backend.http"
)


class HTTPLoggingMiddleware(
    BaseHTTPMiddleware
):
    async def dispatch(
        self,
        request: Request,
        call_next,
    ):
        started_at = time.perf_counter()

        try:
            response = await call_next(
                request
            )

        except Exception:
            request_id = getattr(
                request.state,
                "request_id",
                None,
            )

            duration_ms = round(
                (
                    time.perf_counter()
                    - started_at
                )
                * 1000,
                2,
            )

            http_logger.exception(
                "HTTP request failed",
                extra={
                    "event":
                        "http_request_failed",
                    "request_id":
                        request_id,
                    "method":
                        request.method,
                    "path":
                        request.url.path,
                    "duration_ms":
                        duration_ms,
                    "error_code":
                        "INTERNAL_SERVER_ERROR",
                },
            )

            raise

        request_id = getattr(
            request.state,
            "request_id",
            None,
        )

        duration_ms = round(
            (
                time.perf_counter()
                - started_at
            )
            * 1000,
            2,
        )

        http_logger.info(
            "HTTP request completed",
            extra={
                "event":
                    "http_request_completed",
                "request_id":
                    request_id,
                "method":
                    request.method,
                "path":
                    request.url.path,
                "status_code":
                    response.status_code,
                "duration_ms":
                    duration_ms,
            },
        )

        return response
