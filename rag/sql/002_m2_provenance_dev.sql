CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Logical Source
-- ============================================================

CREATE TABLE IF NOT EXISTS m2_sources (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,

    canonical_url TEXT NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'web',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (project_id, canonical_url)
);

CREATE INDEX IF NOT EXISTS idx_m2_sources_project
ON m2_sources (project_id);


-- ============================================================
-- Immutable Source Version
-- ============================================================

CREATE TABLE IF NOT EXISTS m2_source_versions (
    id UUID PRIMARY KEY,

    source_id UUID NOT NULL
        REFERENCES m2_sources(id)
        ON DELETE CASCADE,

    retrieved_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,

    final_url TEXT NOT NULL,

    content_hash TEXT NOT NULL,

    storage_uri TEXT NOT NULL,

    http_status INTEGER,
    content_type TEXT,

    parser_version TEXT NOT NULL,

    metadata JSONB NOT NULL
        DEFAULT '{}'::jsonb,

    CONSTRAINT chk_m2_source_version_hash
        CHECK (char_length(content_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_m2_source_versions_source
ON m2_source_versions (source_id);

CREATE INDEX IF NOT EXISTS idx_m2_source_versions_hash
ON m2_source_versions (content_hash);


-- ============================================================
-- Logical Document
-- ============================================================

CREATE TABLE IF NOT EXISTS m2_documents (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    source_id UUID NOT NULL
        REFERENCES m2_sources(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m2_documents_project
ON m2_documents (project_id);

CREATE INDEX IF NOT EXISTS idx_m2_documents_source
ON m2_documents (source_id);


-- ============================================================
-- Immutable Document Version
-- ============================================================

CREATE TABLE IF NOT EXISTS m2_document_versions (
    id UUID PRIMARY KEY,

    document_id UUID NOT NULL
        REFERENCES m2_documents(id)
        ON DELETE CASCADE,

    source_version_id UUID NOT NULL
        REFERENCES m2_source_versions(id),

    content_hash TEXT NOT NULL,

    parser_version TEXT NOT NULL,

    extraction_metadata JSONB NOT NULL
        DEFAULT '{}'::jsonb,

    ocr_status TEXT NOT NULL
        DEFAULT 'NOT_REQUIRED',

    page_count INTEGER NOT NULL
        CHECK (page_count >= 0),

    processing_timestamp TIMESTAMPTZ NOT NULL,

    storage_location TEXT NOT NULL,

    extraction_status TEXT NOT NULL
        DEFAULT 'COMPLETE',

    error_code TEXT,

    CONSTRAINT chk_m2_document_version_hash
        CHECK (char_length(content_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_m2_document_versions_document
ON m2_document_versions (document_id);

CREATE INDEX IF NOT EXISTS idx_m2_document_versions_source_version
ON m2_document_versions (source_version_id);

CREATE INDEX IF NOT EXISTS idx_m2_document_versions_hash
ON m2_document_versions (content_hash);


-- ============================================================
-- Immutability Protection
-- ============================================================

CREATE OR REPLACE FUNCTION m2_reject_immutable_update()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION
        '% is immutable; create a new version instead',
        TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_m2_source_versions_immutable
ON m2_source_versions;

CREATE TRIGGER trg_m2_source_versions_immutable
BEFORE UPDATE ON m2_source_versions
FOR EACH ROW
EXECUTE FUNCTION m2_reject_immutable_update();


DROP TRIGGER IF EXISTS trg_m2_document_versions_immutable
ON m2_document_versions;

CREATE TRIGGER trg_m2_document_versions_immutable
BEFORE UPDATE ON m2_document_versions
FOR EACH ROW
EXECUTE FUNCTION m2_reject_immutable_update();


COMMENT ON TABLE m2_source_versions IS
'M2 development immutable source snapshots. Final production schema belongs to M3 migrations.';

COMMENT ON TABLE m2_document_versions IS
'M2 development immutable processed document versions. Final production schema belongs to M3 migrations.';
