from __future__ import annotations

import ast
import os
import time
from typing import Optional, Tuple

import pandas as pd

ENC = "utf-8"  # si falla, cambia a "latin1"
RECIPES_FILE = "RAW_recipes.csv"

# Estructura de cache igual a tu loader anterior
_CACHE = {
    "loaded": False,
    "error": None,
    "load_time_sec": None,
    "rows_loaded": 0,
    "recipes_df": None,
    "last_loaded_at": None,
}

# Índices típicos del campo nutrition en Food.com RAW_recipes:
# [calories, total_fat, sugar, sodium, protein, saturated_fat, carbohydrates]
_NUT_KEYS = ["calories", "fat", "sugar", "sodium", "protein", "sat_fat", "carbs"]


def _read_csv(data_dir: str, name: str) -> pd.DataFrame:
    path = os.path.join(data_dir, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing file: {path}")
    return pd.read_csv(path, encoding=ENC)


def _safe_literal_eval(x):
    """Parse strings like "['a','b']" or "[123, 4.5, ...]" into Python objects."""
    if pd.isna(x):
        return []
    if isinstance(x, (list, dict)):
        return x
    if not isinstance(x, str):
        return []
    x = x.strip()
    if not x:
        return []
    try:
        return ast.literal_eval(x)
    except Exception:
        return []


def _extract_nutrition_cols(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "nutrition" not in df.columns:
        # si tu versión no tiene nutrition, igual dejamos columnas vacías
        for k in _NUT_KEYS:
            df[k] = None
        return df

    # nutrition -> list
    df["nutrition"] = df["nutrition"].apply(_safe_literal_eval)

    def _get_i(arr, i):
        try:
            return float(arr[i])
        except Exception:
            return None

    for i, k in enumerate(_NUT_KEYS):
        df[k] = df["nutrition"].apply(lambda arr: _get_i(arr, i) if isinstance(arr, list) else None)

    return df


def build_recipes_df(data_dir: str) -> pd.DataFrame:
    df = _read_csv(data_dir, RECIPES_FILE)

    # Parseo de listas típicas en este dataset
    for col in ["tags", "steps", "ingredients", "nutrition"]:
        if col in df.columns:
            df[col] = df[col].apply(_safe_literal_eval)

    # Columnas nutricionales numéricas
    df = _extract_nutrition_cols(df)

    # Normalizaciones
    if "name" in df.columns:
        df["name"] = df["name"].astype(str).str.strip()
    if "minutes" in df.columns:
        df["minutes"] = pd.to_numeric(df["minutes"], errors="coerce")

    # Campos de texto útiles para búsqueda
    df["name_norm"] = df["name"].astype(str).str.lower().str.strip() if "name" in df.columns else ""
    df["tags_norm"] = df["tags"].apply(lambda x: " ".join(x).lower() if isinstance(x, list) else "")
    df["ingredients_norm"] = df["ingredients"].apply(lambda x: " ".join(x).lower() if isinstance(x, list) else "")

    # Filtros “anti-basura” (ajustables)
    if "calories" in df.columns:
        df = df[df["calories"].between(50, 2000, inclusive="both") | df["calories"].isna()]
    if "minutes" in df.columns:
        df = df[df["minutes"].between(1, 600, inclusive="both") | df["minutes"].isna()]

    # Mantén columnas clave (ajusta si tu dataset trae nombres distintos)
    keep = []
    for c in ["id", "name", "minutes", "tags", "steps", "ingredients", "nutrition"] + _NUT_KEYS + [
        "name_norm", "tags_norm", "ingredients_norm"
    ]:
        if c in df.columns:
            keep.append(c)

    return df[keep].copy()


def ensure_loaded(data_dir: str) -> None:
    if _CACHE["loaded"]:
        return

    start = time.time()
    try:
        recipes_df = build_recipes_df(data_dir)
        _CACHE["recipes_df"] = recipes_df
        _CACHE["rows_loaded"] = int(recipes_df.shape[0])
        _CACHE["loaded"] = True
        _CACHE["error"] = None
    except Exception as e:
        _CACHE["loaded"] = False
        _CACHE["error"] = str(e)
        raise
    finally:
        _CACHE["load_time_sec"] = round(time.time() - start, 3)
        _CACHE["last_loaded_at"] = time.strftime("%Y-%m-%d %H:%M:%S")


def get_recipes_df(data_dir: str) -> pd.DataFrame:
    ensure_loaded(data_dir)
    return _CACHE["recipes_df"]


def get_loader_status() -> dict:
    return {
        "loaded": _CACHE["loaded"],
        "rows_loaded": _CACHE["rows_loaded"],
        "load_time_sec": _CACHE["load_time_sec"],
        "error": _CACHE["error"],
        "last_loaded_at": _CACHE["last_loaded_at"],
        "file": RECIPES_FILE,
        "nutrition_keys": _NUT_KEYS,
    }


def reload_data(data_dir: str) -> None:
    _CACHE["loaded"] = False
    _CACHE["error"] = None
    _CACHE["recipes_df"] = None
    ensure_loaded(data_dir)
