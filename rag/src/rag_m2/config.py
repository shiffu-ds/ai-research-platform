from dataclasses import dataclass
import os

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    # --------------------------------------------------
    # RAG configuration
    # --------------------------------------------------

    chunk_size: int = int(
        os.getenv("RAG_CHUNK_SIZE", "800")
    )

    chunk_overlap: int = int(
        os.getenv("RAG_CHUNK_OVERLAP", "120")
    )

    dense_top_k: int = int(
        os.getenv("RAG_DENSE_TOP_K", "50")
    )

    lexical_top_k: int = int(
        os.getenv("RAG_LEXICAL_TOP_K", "50")
    )

    fused_top_k: int = int(
        os.getenv("RAG_FUSED_TOP_K", "50")
    )

    final_top_k: int = int(
        os.getenv("RAG_FINAL_TOP_K", "10")
    )

    rrf_k: int = int(
        os.getenv("RAG_RRF_K", "60")
    )

    # --------------------------------------------------
    # Embeddings
    # --------------------------------------------------

    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL",
        "text-embedding-3-large",
    )

    embedding_dimensions: int = int(
        os.getenv(
            "EMBEDDING_DIMENSIONS",
            "3072",
        )
    )

    # --------------------------------------------------
    # Reranker
    # --------------------------------------------------

    reranker_model: str = os.getenv(
        "RERANKER_MODEL",
        "cross-encoder/ms-marco-MiniLM-L-6-v2",
    )

    reranker_enabled: bool = (
        os.getenv(
            "RERANKER_ENABLED",
            "true",
        ).lower()
        == "true"
    )
    # --------------------------------------------------
    # Evidence extraction
    # --------------------------------------------------

    evidence_extraction_model: str = os.getenv(
        "EVIDENCE_EXTRACTION_MODEL",
        "gpt-5.6-luna",
    )

    # --------------------------------------------------
    # Document processing
    # --------------------------------------------------

    max_upload_mb: int = int(
        os.getenv("MAX_UPLOAD_MB", "100")
    )

    pdf_text_coverage_threshold: float = float(
        os.getenv(
            "PDF_TEXT_COVERAGE_THRESHOLD",
            "0.85",
        )
    )

    ocr_confidence_threshold: float = float(
        os.getenv(
            "OCR_CONFIDENCE_THRESHOLD",
            "0.75",
        )
    )

    table_unresolved_threshold: float = float(
        os.getenv(
            "TABLE_UNRESOLVED_THRESHOLD",
            "0.10",
        )
    )

    image_min_bytes: int = int(
        os.getenv(
            "IMAGE_MIN_BYTES",
            str(50 * 1024),
        )
    )
    image_ocr_enabled: bool = (
        os.getenv(
            "IMAGE_OCR_ENABLED",
            "false",
        ).lower()
        == "true"
    )

    ocr_enabled: bool = (
        os.getenv(
            "OCR_ENABLED",
            "true",
        ).lower()
        == "true"
    )

    tesseract_cmd: str | None = os.getenv(
        "TESSERACT_CMD"
    )

    # --------------------------------------------------
    # Infrastructure
    # --------------------------------------------------

    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://rag:rag@localhost:5433/rag_dev",
    )

    # --------------------------------------------------
    # APIs
    # --------------------------------------------------

    openai_api_key: str | None = os.getenv(
        "OPENAI_API_KEY"
    )

    tavily_api_key: str | None = os.getenv(
        "TAVILY_API_KEY"
    )


settings = Settings()