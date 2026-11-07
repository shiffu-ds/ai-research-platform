CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS m2_document_chunks (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,
    document_version_id UUID NOT NULL,
    source_version_id UUID,

    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    page_number INTEGER,

    content TEXT NOT NULL,
    token_count INTEGER NOT NULL CHECK (token_count >= 0),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    embedding halfvec(3072),
    embedding_model TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (document_version_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_m2_chunks_project
ON m2_document_chunks (project_id);

CREATE INDEX IF NOT EXISTS idx_m2_chunks_document_version
ON m2_document_chunks (document_version_id);

CREATE INDEX IF NOT EXISTS idx_m2_chunks_source_version
ON m2_document_chunks (source_version_id);

CREATE INDEX IF NOT EXISTS idx_m2_chunks_embedding_hnsw
ON m2_document_chunks
USING hnsw (embedding halfvec_cosine_ops);

COMMENT ON TABLE m2_document_chunks IS
'M2 local RAG development table. Final shared production schema will be integrated with M3 migrations.';
