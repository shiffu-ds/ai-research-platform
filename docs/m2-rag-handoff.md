# M2 Research / RAG Integration Handoff

## Status

M2 Research/RAG implementation is acceptance-ready.

Current validation:

- 100/100 M2 tests passing
- Local M2 benchmark: PASS
- Retrieval provenance cleanup verified
- GH-19 through GH-32 acceptance coverage completed

---

# 1. Ownership Boundary

## M2 owns

- Source discovery
- Source ingestion
- Immutable source versions
- Document processing
- PDF extraction
- OCR
- Table extraction
- Image extraction
- Text normalization
- Chunking
- Embeddings
- Dense retrieval
- BM25 lexical retrieval
- Reciprocal Rank Fusion
- Cross-encoder reranking
- Retrieval provenance
- Evidence extraction
- Citation generation
- RAG service boundary

## M1 owns

- LangGraph orchestration
- Agent sequencing
- Research-run lifecycle
- Model routing
- Prompt registry
- Validation / repair loops
- Contradiction / analysis orchestration
- Report generation orchestration

## M3 owns

- FastAPI endpoints
- Authentication
- Project authorization / RBAC
- Production database integration
- SQLAlchemy models
- Production migrations
- Research-run persistence
- API request / response schemas
- Redis / Celery backend integration

M2 must not perform user authentication or decide whether a
caller is authorized to access a project.

M3 must authorize the request before passing `project_id`
to M2.

---

# 2. Main Integration Entry Point

Use:

```python
from rag_m2.rag_service import (
    create_default_rag_service,
)