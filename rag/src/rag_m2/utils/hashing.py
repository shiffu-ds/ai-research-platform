import hashlib
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(
        data
    ).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(
        text.encode("utf-8")
    )


def sha256_file(
    file_path: str | Path,
    buffer_size: int = 1024 * 1024,
) -> str:

    file_path = Path(file_path)

    digest = hashlib.sha256()

    with file_path.open("rb") as file:

        while True:
            chunk = file.read(
                buffer_size
            )

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()

def evidence_sha256(
    excerpt: str,
    locator: str,
) -> str:
    """
    SHA-256 required for evidence provenance.

    Specification:
        SHA256(excerpt + locator)
    """

    if not excerpt:
        raise ValueError(
            "Evidence excerpt cannot be empty."
        )

    if not locator:
        raise ValueError(
            "Evidence locator cannot be empty."
        )

    return sha256_text(
        excerpt + locator
    )