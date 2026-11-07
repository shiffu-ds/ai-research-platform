from datetime import (
    datetime,
    timezone,
)
import uuid

import pytest

from rag_m2.citations.context_provider import (
    PostgresCitationContextProvider,
)
from rag_m2.citations.generator import (
    CitationGenerationError,
    CitationGenerator,
)
from rag_m2.citations.models import (
    CitationContext,
)
from rag_m2.schemas import (
    EvidenceRecord,
)
from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.utils.hashing import (
    evidence_sha256,
    sha256_bytes,
)


def make_evidence(
    *,
    source_version_id: str = "source-version-1",
    document_version_id: str = "document-version-1",
) -> EvidenceRecord:

    excerpt = (
        "Artificial intelligence supports "
        "evidence-based research."
    )

    locator = (
        "page:2;chunk:chunk-1"
    )

    return EvidenceRecord(
        evidence_id="evidence-1",

        claim_id="claim-1",

        document_chunk_id=(
            "chunk-1"
        ),

        source_version_id=(
            source_version_id
        ),

        document_version_id=(
            document_version_id
        ),

        excerpt=excerpt,

        locator=locator,

        extraction_method=(
            "deterministic-test"
        ),

        model_version=None,

        created_at=datetime.now(
            timezone.utc
        ),

        evidence_hash=(
            evidence_sha256(
                excerpt,
                locator,
            )
        ),
    )


def make_context(
    *,
    source_version_id: str = "source-version-1",
    document_version_id: str = "document-version-1",
) -> CitationContext:

    now = datetime.now(
        timezone.utc
    )

    return CitationContext(
        source_id="source-1",

        source_version_id=(
            source_version_id
        ),

        source_title=(
            "Research Source"
        ),

        canonical_url=(
            "https://example.com/research"
        ),

        final_url=(
            "https://example.com/research"
        ),

        source_content_hash=(
            "a" * 64
        ),

        snapshot_uri=(
            "local://snapshot/version-1"
        ),

        retrieved_at=now,

        published_at=None,

        document_id="document-1",

        document_version_id=(
            document_version_id
        ),

        document_title=(
            "Research Document"
        ),
    )


class FakeContextProvider:
    def __init__(
        self,
        context,
    ):
        self.context = context

    def resolve(
        self,
        source_version_id: str,
        document_version_id: str,
    ):
        return self.context


def test_citation_preserves_immutable_provenance():

    evidence = make_evidence()

    context = make_context()

    generator = CitationGenerator(
        context_provider=(
            FakeContextProvider(
                context
            )
        )
    )

    citation = generator.generate(
        evidence
    )

    assert (
        citation.evidence_id
        == evidence.evidence_id
    )

    assert (
        citation.document_chunk_id
        == evidence.document_chunk_id
    )

    assert (
        citation.document_version_id
        == evidence.document_version_id
    )

    assert (
        citation.source_version_id
        == evidence.source_version_id
    )

    assert (
        citation.snapshot_uri
        == context.snapshot_uri
    )

    assert (
        citation.source_content_hash
        == context.source_content_hash
    )

    assert (
        citation.locator
        == evidence.locator
    )

    assert (
        "source_version:"
        in citation.audit_reference
    )


def test_tampered_evidence_is_rejected():

    evidence = make_evidence()

    evidence.evidence_hash = (
        "0" * 64
    )

    generator = CitationGenerator(
        context_provider=(
            FakeContextProvider(
                make_context()
            )
        )
    )

    with pytest.raises(
        CitationGenerationError
    ):
        generator.generate(
            evidence
        )


def test_missing_provenance_chain_is_rejected():

    evidence = make_evidence()

    generator = CitationGenerator(
        context_provider=(
            FakeContextProvider(
                None
            )
        )
    )

    with pytest.raises(
        CitationGenerationError
    ):
        generator.generate(
            evidence
        )


def test_mismatched_source_version_is_rejected():

    evidence = make_evidence()

    wrong_context = make_context(
        source_version_id=(
            "different-source-version"
        )
    )

    generator = CitationGenerator(
        context_provider=(
            FakeContextProvider(
                wrong_context
            )
        )
    )

    with pytest.raises(
        CitationGenerationError
    ):
        generator.generate(
            evidence
        )


def test_postgres_context_resolves_exact_version_chain():

    repository = VersionRepository()

    provider = (
        PostgresCitationContextProvider()
    )

    project_id = str(
        uuid.uuid4()
    )

    source = repository.create_source(
        project_id=project_id,

        canonical_url=(
            "https://example.com/"
            "citation-test"
        ),

        title="Citation Test Source",
    )

    source_version = (
        repository.create_source_version(
            source_id=source.id,

            content_hash=(
                sha256_bytes(
                    b"citation source"
                )
            ),

            final_url=(
                "https://example.com/"
                "citation-test"
            ),

            storage_uri=(
                "local://citation/"
                "source-version"
            ),

            parser_version="test-v1",

            http_status=200,

            content_type="text/html",
        )
    )

    document = (
        repository.create_document(
            project_id=project_id,

            source_id=source.id,

            title=(
                "Citation Test Document"
            ),
        )
    )

    document_version = (
        repository.create_document_version(
            document_id=document.id,

            source_version_id=(
                source_version.id
            ),

            content_hash=(
                sha256_bytes(
                    b"citation document"
                )
            ),

            parser_version="test-v1",

            page_count=1,

            storage_location=(
                "local://citation/document"
            ),
        )
    )

    try:

        context = provider.resolve(
            source_version_id=(
                source_version.id
            ),

            document_version_id=(
                document_version.id
            ),
        )

        assert context is not None

        assert (
            context.source_id
            == source.id
        )

        assert (
            context.source_version_id
            == source_version.id
        )

        assert (
            context.document_id
            == document.id
        )

        assert (
            context.document_version_id
            == document_version.id
        )

        assert (
            context.snapshot_uri
            == source_version.storage_uri
        )

    finally:

        repository.delete_source(
            source.id
        )