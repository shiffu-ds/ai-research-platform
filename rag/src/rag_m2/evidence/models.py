from dataclasses import dataclass


@dataclass(frozen=True)
class SelectedExcerpt:
    """
    Structured output produced by an evidence
    excerpt selector.
    """

    excerpt: str

    extraction_method: str

    model_version: str | None = None