"""
Evaluation Metrics Calculator for AI Benchmark (GH-18, v4.0 §24).
Computes exact formulas for Recall@10, MRR, citation correctness, and claim rates.
"""

from typing import Any, Sequence


class EvaluationMetrics:
    """
    Formulas and calculators for all staging gate metrics defined in §24.
    """

    @staticmethod
    def calculate_recall_at_k(retrieved_ids: Sequence[str], relevant_ids: Sequence[str], k: int = 10) -> float:
        """Recall@k = (relevant items retrieved in top k) / (total relevant items)."""
        if not relevant_ids:
            return 1.0
        top_k = retrieved_ids[:k]
        hits = sum(1 for r in relevant_ids if r in top_k)
        return float(hits / len(relevant_ids))

    @staticmethod
    def calculate_precision_at_k(retrieved_ids: Sequence[str], relevant_ids: Sequence[str], k: int = 10) -> float:
        """Precision@k = (relevant items retrieved in top k) / k."""
        top_k = retrieved_ids[:k]
        if not top_k:
            return 0.0
        hits = sum(1 for item in top_k if item in relevant_ids)
        return float(hits / len(top_k))

    @staticmethod
    def calculate_mrr(retrieved_ids: Sequence[str], relevant_ids: Sequence[str]) -> float:
        """Mean Reciprocal Rank (MRR) = 1 / rank of first relevant item."""
        if not relevant_ids:
            return 1.0
        for rank, item in enumerate(retrieved_ids, start=1):
            if item in relevant_ids:
                return 1.0 / rank
        return 0.0

    @staticmethod
    def calculate_citation_correctness(citations: list[dict[str, Any]], verified_evidence_ids: set[str]) -> float:
        """Fraction of citations that link to valid, verified evidence records."""
        if not citations:
            return 1.0
        valid_citations = sum(1 for c in citations if c.get("evidence_id") in verified_evidence_ids)
        return float(valid_citations / len(citations))

    @staticmethod
    def calculate_supported_claim_rate(claims: list[dict[str, Any]]) -> float:
        """Fraction of claims that have verified supporting evidence attached."""
        if not claims:
            return 1.0
        supported = sum(1 for c in claims if c.get("is_supported", False) and len(c.get("evidence_ids", [])) > 0)
        return float(supported / len(claims))

    @staticmethod
    def calculate_f1_score(precision: float, recall: float) -> float:
        """Standard harmonic mean F1 score."""
        if precision + recall == 0:
            return 0.0
        return 2 * (precision * recall) / (precision + recall)
