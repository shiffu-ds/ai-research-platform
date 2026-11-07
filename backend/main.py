from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.api.v1.health import router as health_router
from backend.api.v1.router import api_router
from backend.config import Settings
from backend.middleware.logging import (
    HTTPLoggingMiddleware,
    configure_logging,
)
from backend.middleware.request_id import (
    RequestIDMiddleware,
)
from backend.schemas.errors import (
    error_envelope,
)


settings = Settings()

configure_logging(
    settings.log_level
)

app = FastAPI(
    title="Autonomous AI Research Platform API",
    version="0.1.0",
)

# Middleware order matters.
# RequestIDMiddleware must run before HTTP logging.
app.add_middleware(
    HTTPLoggingMiddleware
)
app.add_middleware(
    RequestIDMiddleware
)


def configure_cors(target: FastAPI, cfg: Settings) -> None:
    """
    Allow the browser frontend (a different origin) to call the API.

    The frontend sends credentials and opens the SSE stream with
    withCredentials, so origins must be listed explicitly — a wildcard is not
    allowed with credentials. Added last so it is the outermost middleware
    and answers preflight requests before anything else runs.
    """
    origins = cfg.cors_origin_list
    if not origins:
        return
    target.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Last-Event-ID", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )


configure_cors(app, settings)


@app.exception_handler(
    StarletteHTTPException
)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
):
    request_id = getattr(
        request.state,
        "request_id",
        "req_unknown",
    )

    if exc.status_code == 404:
        code = "NOT_FOUND"
        message = "Resource not found."
    else:
        code = "HTTP_ERROR"
        message = (
            "Request could not be completed."
        )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope(
            code=code,
            message=message,
            request_id=request_id,
        ),
    )


app.include_router(
    health_router
)

app.include_router(
    api_router,
    prefix=settings.api_v1_prefix,
)
