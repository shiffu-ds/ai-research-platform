-- ============================================================
-- M2 Local Retrieval Provenance
--
-- Development/reference persistence owned by M2.
-- Final shared production migrations belong to M3.
-- ============================================================


-- ============================================================
-- Retrieval Run
-- ============================================================

CREATE TABLE IF NOT EXISTS m2_retrieval_runs (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    query_hash TEXT NOT NULL,

    requested_top_k INTEGER NOT NULL
        CHECK (requested_top_k > 0),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT chk_m2_retrieval_run_query_hash
        CHECK (char_length(query_hash) = 64)
);


CREATE INDEX IF NOT EXISTS
idx_m2_retrieval_runs_project
ON m2_retrieval_runs (
    project_id
);


CREATE INDEX IF NOT EXISTS
idx_m2_retrieval_runs_query_hash
ON m2_retrieval_runs (
    query_hash
);


-- ============================================================
-- Retrieval Results
-- ============================================================

CREATE TABLE IF NOT EXISTS m2_retrieval_results (
    id UUID PRIMARY KEY,

    retrieval_run_id UUID NOT NULL
        REFERENCES m2_retrieval_runs(id)
        ON DELETE CASCADE,

    document_chunk_id UUID NOT NULL
        REFERENCES m2_document_chunks(id)
        ON DELETE CASCADE,

    retrieval_method TEXT NOT NULL,

    rank INTEGER NOT NULL
        CHECK (rank > 0),

    score DOUBLE PRECISION NOT NULL,

    retrieval_timestamp TIMESTAMPTZ NOT NULL,

    query_hash TEXT NOT NULL,

    reranker_version TEXT,

    embedding_model TEXT,

    CONSTRAINT chk_m2_retrieval_method
        CHECK (
            retrieval_method IN (
                'dense',
                'lexical',
                'fused'
            )
        ),

    CONSTRAINT chk_m2_retrieval_result_query_hash
        CHECK (
            char_length(query_hash) = 64
        ),

    UNIQUE (
        retrieval_run_id,
        rank
    ),

    UNIQUE (
        retrieval_run_id,
        document_chunk_id
    )
);


CREATE INDEX IF NOT EXISTS
idx_m2_retrieval_results_run
ON m2_retrieval_results (
    retrieval_run_id
);


CREATE INDEX IF NOT EXISTS
idx_m2_retrieval_results_chunk
ON m2_retrieval_results (
    document_chunk_id
);


COMMENT ON TABLE m2_retrieval_runs IS
'M2 local development retrieval-run provenance. Final production schema/migrations belong to M3.';


COMMENT ON TABLE m2_retrieval_results IS
'M2 local persisted retrieval provenance required by GH-31. Final production persistence belongs to M3.';