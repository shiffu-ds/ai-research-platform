from typing import Any


def error_envelope(
    *,
    code: str,
    message: str,
    request_id: str,
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "requestId": request_id,
        }
    }
