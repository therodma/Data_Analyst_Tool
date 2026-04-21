import pandas as pd
import numpy as np
from scipy import stats
from thefuzz import fuzz
from typing import Any

LOW_CARDINALITY_THRESHOLD = 20
MISSING_FLAG_PCT = 20.0
SKEW_THRESHOLD = 1.0
IQR_MULTIPLIER = 1.5
FUZZY_MATCH_THRESHOLD = 85


def analyze(df: pd.DataFrame) -> dict[str, Any]:
    report: dict[str, Any] = {
        "shape": {"rows": int(df.shape[0]), "cols": int(df.shape[1])},
        "columns": {},
        "duplicates": _analyze_duplicates(df),
    }
    for col in df.columns:
        report["columns"][col] = _analyze_column(df, col)
    return report


def _analyze_duplicates(df: pd.DataFrame) -> dict[str, Any]:
    exact = int(df.duplicated().sum())
    return {"exact_count": exact, "exact_pct": round(exact / len(df) * 100, 2) if len(df) else 0}


def _analyze_column(df: pd.DataFrame, col: str) -> dict[str, Any]:
    series = df[col]
    total = len(series)
    missing = int(series.isna().sum())
    missing_pct = round(missing / total * 100, 2) if total else 0

    info: dict[str, Any] = {
        "dtype": str(series.dtype),
        "missing_count": missing,
        "missing_pct": missing_pct,
        "missing_flagged": missing_pct > MISSING_FLAG_PCT,
        "outliers": None,
        "skewness": None,
        "skew_flagged": False,
        "categories": None,
    }

    numeric = pd.api.types.is_numeric_dtype(series)
    if numeric:
        clean = series.dropna()
        if len(clean) >= 4:
            q1, q3 = float(clean.quantile(0.25)), float(clean.quantile(0.75))
            iqr = q3 - q1
            lower, upper = q1 - IQR_MULTIPLIER * iqr, q3 + IQR_MULTIPLIER * iqr
            outlier_mask = (clean < lower) | (clean > upper)
            outlier_count = int(outlier_mask.sum())
            info["outliers"] = {
                "count": outlier_count,
                "pct": round(outlier_count / total * 100, 2),
                "lower_bound": round(lower, 4),
                "upper_bound": round(upper, 4),
            }
            skew = float(stats.skew(clean))
            info["skewness"] = round(skew, 4)
            info["skew_flagged"] = abs(skew) > SKEW_THRESHOLD
    else:
        clean_str = series.dropna().astype(str)
        unique_vals = clean_str.unique()
        if 1 < len(unique_vals) <= LOW_CARDINALITY_THRESHOLD:
            value_counts = clean_str.value_counts().to_dict()
            variants = _detect_variants(list(unique_vals))
            info["categories"] = {
                "unique_count": len(unique_vals),
                "value_counts": {str(k): int(v) for k, v in value_counts.items()},
                "suspected_variants": variants,
            }

    return info


def _detect_variants(values: list[str]) -> list[list[str]]:
    """Group values that are likely variants of each other via fuzzy matching."""
    groups: list[list[str]] = []
    visited = set()
    for i, v1 in enumerate(values):
        if v1 in visited:
            continue
        group = [v1]
        for v2 in values[i + 1:]:
            if v2 in visited:
                continue
            score = fuzz.ratio(v1.lower().strip(), v2.lower().strip())
            if score >= FUZZY_MATCH_THRESHOLD:
                group.append(v2)
                visited.add(v2)
        if len(group) > 1:
            groups.append(group)
            visited.add(v1)
    return groups
