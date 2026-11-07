"""
Deterministic Calculation Service (GH-06, v4.0 §21).
Performs exact arithmetic, unit conversions, and statistical comparisons.
LLMs must never replace deterministic calculations.
"""

from typing import Any
import uuid

from agents.schemas import CalculationRecord


class CalculationService:
    """
    Deterministic calculation engine for quantitative facts (§21).
    All calculations record audit trails with formula, inputs, precision, and result.
    """

    UNIT_CONVERSIONS = {
        ("usd", "eur"): 0.92,
        ("eur", "usd"): 1.087,
        ("gbp", "usd"): 1.28,
        ("percent", "ratio"): 0.01,
        ("ratio", "percent"): 100.0,
        ("mb", "gb"): 0.0009765625,
        ("gb", "mb"): 1024.0,
        ("ms", "s"): 0.001,
        ("s", "ms"): 1000.0,
    }

    @classmethod
    def convert_unit(cls, value: float, from_unit: str, to_unit: str, precision: int = 4) -> CalculationRecord:
        """Deterministically convert numeric value between supported units."""
        from_u = from_unit.strip().lower()
        to_u = to_unit.strip().lower()
        if from_u == to_u:
            res = round(value, precision)
            formula = f"{value} {from_u} == {res} {to_u}"
        elif (from_u, to_u) in cls.UNIT_CONVERSIONS:
            rate = cls.UNIT_CONVERSIONS[(from_u, to_u)]
            res = round(value * rate, precision)
            formula = f"{value} * {rate}"
        else:
            raise ValueError(f"Unsupported unit conversion from '{from_unit}' to '{to_unit}'.")

        return CalculationRecord(
            calculation_id=str(uuid.uuid4()),
            operation="convert_unit",
            input_data={"value": value, "from_unit": from_unit, "to_unit": to_unit},
            formula=formula,
            result=res,
            unit=to_unit,
            precision=precision,
        )

    @classmethod
    def weighted_average(cls, values: list[float], weights: list[float], precision: int = 4) -> CalculationRecord:
        """Compute weighted average deterministically."""
        if len(values) != len(weights) or not values:
            raise ValueError("Values and weights must have matching non-zero lengths.")
        total_weight = sum(weights)
        if total_weight == 0:
            raise ValueError("Sum of weights cannot be zero.")

        weighted_sum = sum(v * w for v, w in zip(values, weights))
        res = round(weighted_sum / total_weight, precision)
        formula = f"sum(v_i * w_i) / sum(w_i) => {weighted_sum} / {total_weight}"

        return CalculationRecord(
            calculation_id=str(uuid.uuid4()),
            operation="weighted_average",
            input_data={"values": values, "weights": weights},
            formula=formula,
            result=res,
            unit=None,
            precision=precision,
        )

    @classmethod
    def statistical_comparison(cls, val1: float, val2: float, precision: int = 4) -> CalculationRecord:
        """Compute relative percentage difference between two values."""
        if val1 == 0 and val2 == 0:
            diff_pct = 0.0
        elif val1 == 0:
            diff_pct = 100.0
        else:
            diff_pct = round(abs(val1 - val2) / abs(val1) * 100.0, precision)

        formula = f"abs({val1} - {val2}) / abs({val1}) * 100"
        return CalculationRecord(
            calculation_id=str(uuid.uuid4()),
            operation="statistical_comparison",
            input_data={"val1": val1, "val2": val2},
            formula=formula,
            result=diff_pct,
            unit="percent_diff",
            precision=precision,
        )
