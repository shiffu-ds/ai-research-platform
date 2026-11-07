import uuid

import psycopg
import pytest

from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.utils.hashing import (
    sha256_bytes,
)


def test_source_can_have_multiple_immutable_versions():

    repository = VersionRepository()

    project_id = str(
        uuid.uuid4()
    )

    source = repository.create_source(
        project_id=project_id,
        canonical_url=(
            "https://example.com/research"
        ),
        title="Example Research",
    )

    try:
        first_content = (
            b"first source content"
        )

        second_content = (
            b"updated source content"
        )

        version_1 = (
            repository.create_source_version(
                source_id=source.id,
                content_hash=(
                    sha256_bytes(
                        first_content
                    )
                ),
                final_url=(
                    source.canonical_url
                ),
                storage_uri=(
                    "local://source/v1"
                ),
                parser_version="1.0",
                http_status=200,
                content_type="text/html",
            )
        )

        version_2 = (
            repository.create_source_version(
                source_id=source.id,
                content_hash=(
                    sha256_bytes(
                        second_content
                    )
                ),
                final_url=(
                    source.canonical_url
                ),
                storage_uri=(
                    "local://source/v2"
                ),
                parser_version="1.0",
                http_status=200,
                content_type="text/html",
            )
        )

        assert (
            version_1.id
            != version_2.id
        )

        assert (
            version_1.source_id
            == version_2.source_id
        )

        assert (
            version_1.content_hash
            != version_2.content_hash
        )

    finally:
        repository.delete_source(
            source.id
        )


def test_source_version_cannot_be_updated():

    repository = VersionRepository()

    project_id = str(
        uuid.uuid4()
    )

    source = repository.create_source(
        project_id=project_id,
        canonical_url=(
            "https://example.com/immutable"
        ),
        title="Immutable Source",
    )

    version = (
        repository.create_source_version(
            source_id=source.id,
            content_hash=(
                sha256_bytes(
                    b"immutable content"
                )
            ),
            final_url=(
                source.canonical_url
            ),
            storage_uri=(
                "local://immutable"
            ),
            parser_version="1.0",
            http_status=200,
            content_type="text/plain",
        )
    )

    try:

        with pytest.raises(
            psycopg.Error
        ):

            with repository.connect() as connection:

                with connection.cursor() as cursor:

                    cursor.execute(
                        """
                        UPDATE m2_source_versions
                        SET final_url =
                            'https://changed.example.com'
                        WHERE id = %(id)s;
                        """,
                        {
                            "id": uuid.UUID(
                                version.id
                            )
                        },
                    )

    finally:
        repository.delete_source(
            source.id
        )


def test_document_version_cannot_be_updated():

    repository = VersionRepository()

    project_id = str(
        uuid.uuid4()
    )

    source = repository.create_source(
        project_id=project_id,
        canonical_url=(
            "https://example.com/document"
        ),
        title="Document Source",
    )

    source_version = (
        repository.create_source_version(
            source_id=source.id,
            content_hash=(
                sha256_bytes(
                    b"document bytes"
                )
            ),
            final_url=(
                source.canonical_url
            ),
            storage_uri=(
                "local://document/source"
            ),
            parser_version="1.0",
            http_status=200,
            content_type="application/pdf",
        )
    )

    document = (
        repository.create_document(
            project_id=project_id,
            source_id=source.id,
            title="Research Document",
        )
    )

    document_version = (
        repository.create_document_version(
            document_id=document.id,
            source_version_id=(
                source_version.id
            ),
            content_hash=(
                source_version.content_hash
            ),
            parser_version="pdf-v1",
            page_count=10,
            storage_location=(
                "local://document/version"
            ),
            extraction_metadata={
                "test": True
            },
            ocr_status="NOT_REQUIRED",
        )
    )

    try:

        assert (
            document_version.source_version_id
            == source_version.id
        )

        with pytest.raises(
            psycopg.Error
        ):

            with repository.connect() as connection:

                with connection.cursor() as cursor:

                    cursor.execute(
                        """
                        UPDATE m2_document_versions
                        SET page_count = 999
                        WHERE id = %(id)s;
                        """,
                        {
                            "id": uuid.UUID(
                                document_version.id
                            )
                        },
                    )

    finally:
        repository.delete_source(
            source.id
        )