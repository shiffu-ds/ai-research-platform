from rag_m2.rag_service import (
    M2RAGService,
    create_default_rag_service,
)


def test_default_rag_service_can_be_created_for_integration():

    service = create_default_rag_service(
        api_key="test-integration-key"
    )

    assert isinstance(
        service,
        M2RAGService,
    )

    assert service.pipeline is not None

    assert (
        service.pipeline.retriever
        is not None
    )

    assert (
        service.pipeline.evidence_extractor
        is not None
    )

    assert (
        service.pipeline.citation_generator
        is not None
    )