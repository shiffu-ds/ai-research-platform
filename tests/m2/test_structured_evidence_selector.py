import json
from types import SimpleNamespace

import pytest

from rag_m2.evidence.extractor import (
    EvidenceExtractor,
)
from rag_m2.evidence.structured_selector import (
    OpenAIStructuredEvidenceClient,
    StructuredEvidenceDecision,
    StructuredEvidenceSelectionError,
    StructuredLLMEvidenceSelector,
)
from rag_m2.schemas import (
    RetrievalResult,
)
from rag_m2.utils.hashing import (
    evidence_sha256,
)


SOURCE_TEXT = (
    "Artificial intelligence supports "
    "medical diagnosis. "
    "Weather forecasting uses "
    "different models."
)

EXCERPT = (
    "Artificial intelligence supports "
    "medical diagnosis."
)


class FakeStructuredClient:

    model = (
        "fake-evidence-model-v1"
    )

    def __init__(
        self,
        decisions,
    ):
        self.decisions = list(
            decisions
        )

        self.calls = 0

    def extract_evidence(
        self,
        claim,
        chunk_text,
    ):

        self.calls += 1

        value = self.decisions.pop(
            0
        )

        if isinstance(
            value,
            Exception,
        ):
            raise value

        return value


def test_structured_selector_returns_verbatim_excerpt():

    client = FakeStructuredClient(
        [
            StructuredEvidenceDecision(
                supported=True,
                excerpt=EXCERPT,
            )
        ]
    )

    selector = (
        StructuredLLMEvidenceSelector(
            client=client
        )
    )

    result = selector.select(
        claim=(
            "AI supports medical diagnosis."
        ),

        chunk_text=SOURCE_TEXT,
    )

    assert result is not None

    assert (
        result.excerpt
        == EXCERPT
    )

    assert (
        result.extraction_method
        == "structured_llm_v1"
    )

    assert (
        result.model_version
        == "fake-evidence-model-v1"
    )

    assert client.calls == 1


def test_structured_selector_returns_none_for_unsupported_claim():

    client = FakeStructuredClient(
        [
            StructuredEvidenceDecision(
                supported=False,
                excerpt="",
            )
        ]
    )

    selector = (
        StructuredLLMEvidenceSelector(
            client=client
        )
    )

    result = selector.select(
        claim=(
            "Bananas improve car engines."
        ),

        chunk_text=SOURCE_TEXT,
    )

    assert result is None

    assert client.calls == 1


def test_structured_selector_retries_once():

    client = FakeStructuredClient(
        [
            RuntimeError(
                "temporary model error"
            ),

            StructuredEvidenceDecision(
                supported=True,
                excerpt=EXCERPT,
            ),
        ]
    )

    selector = (
        StructuredLLMEvidenceSelector(
            client=client,
            max_attempts=2,
        )
    )

    result = selector.select(
        claim=(
            "AI supports diagnosis."
        ),

        chunk_text=SOURCE_TEXT,
    )

    assert result is not None

    assert (
        result.excerpt
        == EXCERPT
    )

    assert client.calls == 2


def test_hallucinated_structured_excerpt_is_rejected_after_retry():

    invented = (
        "This text does not exist "
        "inside the source."
    )

    client = FakeStructuredClient(
        [
            StructuredEvidenceDecision(
                supported=True,
                excerpt=invented,
            ),

            StructuredEvidenceDecision(
                supported=True,
                excerpt=invented,
            ),
        ]
    )

    selector = (
        StructuredLLMEvidenceSelector(
            client=client,
            max_attempts=2,
        )
    )

    with pytest.raises(
        StructuredEvidenceSelectionError
    ):

        selector.select(
            claim=(
                "AI supports diagnosis."
            ),

            chunk_text=SOURCE_TEXT,
        )

    assert client.calls == 2


def test_openai_structured_client_uses_json_schema():

    class FakeResponses:

        def __init__(self):
            self.kwargs = None

        def create(
            self,
            **kwargs,
        ):
            self.kwargs = kwargs

            return SimpleNamespace(
                status="completed",

                output_text=json.dumps(
                    {
                        "supported": True,
                        "excerpt": EXCERPT,
                    }
                ),
            )

    fake_responses = (
        FakeResponses()
    )

    fake_openai = (
        SimpleNamespace(
            responses=fake_responses
        )
    )

    client = (
        OpenAIStructuredEvidenceClient(
            model=(
                "fake-openai-model"
            ),

            client=(
                fake_openai
            ),
        )
    )

    result = client.extract_evidence(
        claim=(
            "AI supports diagnosis."
        ),

        chunk_text=SOURCE_TEXT,
    )

    assert result.supported is True

    assert (
        result.excerpt
        == EXCERPT
    )

    request = (
        fake_responses.kwargs
    )

    assert (
        request["model"]
        == "fake-openai-model"
    )

    assert (
        request["text"]
        ["format"]
        ["type"]
        == "json_schema"
    )

    assert (
        request["text"]
        ["format"]
        ["strict"]
        is True
    )


def test_structured_selector_integrates_with_evidence_extractor():

    client = FakeStructuredClient(
        [
            StructuredEvidenceDecision(
                supported=True,
                excerpt=EXCERPT,
            )
        ]
    )

    extractor = (
        EvidenceExtractor(
            selector=(
                StructuredLLMEvidenceSelector(
                    client=client
                )
            )
        )
    )

    retrieval = RetrievalResult(
        chunk_id="chunk-1",

        document_version_id=(
            "document-version-1"
        ),

        source_version_id=(
            "source-version-1"
        ),

        text=SOURCE_TEXT,

        retrieval_method="fused",

        rank=1,

        score=0.95,

        page_number=3,
    )

    records = extractor.extract(
        claim=(
            "AI supports medical diagnosis."
        ),

        claim_id="claim-1",

        ranked_chunks=[
            retrieval
        ],

        max_evidence=1,
    )

    assert len(records) == 1

    record = records[0]

    assert (
        record.excerpt
        == EXCERPT
    )

    assert (
        record.extraction_method
        == "structured_llm_v1"
    )

    assert (
        record.model_version
        == "fake-evidence-model-v1"
    )

    assert (
        record.evidence_hash
        == evidence_sha256(
            EXCERPT,
            (
                "page:3;"
                "chunk:chunk-1"
            ),
        )
    )