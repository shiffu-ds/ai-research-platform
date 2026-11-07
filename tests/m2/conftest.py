import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

RAG_SRC = PROJECT_ROOT / "rag" / "src"

sys.path.insert(0, str(RAG_SRC))