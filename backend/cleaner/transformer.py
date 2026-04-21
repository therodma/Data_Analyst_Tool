import pandas as pd
import numpy as np
from typing import Any

IQR_MULTIPLIER = 1.5


def clean(df: pd.DataFrame, options: dict[str, Any], analysis: dict[str, Any]) -> tuple[pd.DataFrame, dict[str, Any]]:
    df = df.copy()
    log: list[str] = []
    rows_before = len(df)

    if options.get("drop_duplicates"):
        before = len(df)
        df = df.drop_duplicates()
        dropped = before - len(df)
        if dropped:
            log.append(f"Dropped {dropped} exact duplicate rows.")

    col_reports: dict[str, list[str]] = {}

    for col in df.columns:
        col_log: list[str] = []
        col_info = analysis["columns"].get(col, {})
        is_numeric = pd.api.types.is_numeric_dtype(df[col])

        if options.get("fill_missing"):
            missing = df[col].isna().sum()
            if missing > 0:
                if is_numeric:
                    fill_val = df[col].median()
                    df[col] = df[col].fillna(fill_val)
                    col_log.append(f"Filled {missing} missing values with median ({round(fill_val, 4)}).")
                else:
                    mode_vals = df[col].mode()
                    if not mode_vals.empty:
                        fill_val = mode_vals[0]
                        df[col] = df[col].fillna(fill_val)
                        col_log.append(f"Filled {missing} missing values with mode ('{fill_val}').")

        if options.get("handle_outliers") and is_numeric:
            outlier_info = col_info.get("outliers")
            if outlier_info and outlier_info["count"] > 0:
                lower = outlier_info["lower_bound"]
                upper = outlier_info["upper_bound"]
                action = options.get("outlier_action", "clip")
                if action == "clip":
                    df[col] = df[col].clip(lower=lower, upper=upper)
                    col_log.append(f"Clipped {outlier_info['count']} outliers to [{round(lower,4)}, {round(upper,4)}].")
                else:
                    mask = (df[col] >= lower) & (df[col] <= upper) | df[col].isna()
                    removed = (~mask).sum()
                    df = df[mask]
                    col_log.append(f"Removed {removed} rows with outliers in '{col}'.")

        if options.get("standardize_categories") and not is_numeric:
            cat_info = col_info.get("categories")
            if cat_info and cat_info.get("suspected_variants"):
                df[col], changes = _standardize_column(df[col], cat_info["suspected_variants"])
                if changes:
                    col_log.append(f"Standardized {changes} category variant(s).")
            # Always lowercase + strip for low-cardinality columns
            if cat_info:
                original = df[col].copy()
                df[col] = df[col].apply(lambda x: x.strip().lower() if isinstance(x, str) else x)
                changed = (df[col] != original).sum()
                if changed:
                    col_log.append(f"Normalized {changed} values (lowercase + strip).")

        if options.get("log_transform") and is_numeric:
            skew_flagged = col_info.get("skew_flagged", False)
            if skew_flagged and (df[col].dropna() > 0).all():
                df[col] = np.log1p(df[col])
                col_log.append("Applied log1p transform (skewed column).")

        if col_log:
            col_reports[col] = col_log

    recommendations = _build_recommendations(df, analysis, options)

    report = {
        "before_shape": {"rows": rows_before, "cols": analysis["shape"]["cols"]},
        "after_shape": {"rows": len(df), "cols": len(df.columns)},
        "transformations_applied": log,
        "column_changes": col_reports,
        "recommendations": recommendations,
    }
    return df, report


def _standardize_column(series: pd.Series, variant_groups: list[list[str]]) -> tuple[pd.Series, int]:
    series = series.copy()
    changes = 0
    for group in variant_groups:
        counts = series[series.isin(group)].value_counts()
        if counts.empty:
            continue
        canonical = counts.idxmax()
        for val in group:
            if val != canonical:
                mask = series == val
                changes += int(mask.sum())
                series = series.where(~mask, other=canonical)
    return series, changes


def _build_recommendations(df: pd.DataFrame, analysis: dict[str, Any], options: dict[str, Any]) -> list[str]:
    recs: list[str] = []
    for col, info in analysis["columns"].items():
        if col not in df.columns:
            continue
        is_numeric = pd.api.types.is_numeric_dtype(df[col])
        cat_info = info.get("categories")

        if cat_info and not options.get("standardize_categories"):
            recs.append(f"Consider standardizing categories in column `{col}`.")

        if cat_info and cat_info["unique_count"] <= 20:
            recs.append(f"Consider encoding column `{col}` for ML use (e.g., one-hot or label encoding).")

        if info.get("skew_flagged") and not options.get("log_transform"):
            recs.append(f"Column `{col}` is skewed (skew={info['skewness']}). Consider log-transform.")

        if is_numeric and not cat_info:
            recs.append(f"Consider feature scaling (StandardScaler/MinMaxScaler) on column `{col}`.")

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_recs: list[str] = []
    for r in recs:
        if r not in seen:
            seen.add(r)
            unique_recs.append(r)
    return unique_recs
