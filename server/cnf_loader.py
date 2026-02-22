from __future__ import annotations

import os
import time
from typing import Dict, Tuple

import pandas as pd

ENC = "utf-8"  # si falla, prueba "latin1"

INGREDIENTS_FILE = "ingredients_db.csv"
MEALS_FILE = "meals_recipes.csv"

_CACHE = {
    "loaded": False,
    "error": None,
    "load_time_sec": None,
    "rows_loaded": {"ingredients": 0, "meals": 0},
    "ingredients_df": None,
    "meals_df": None,
    "last_loaded_at": None,
}


def _read_csv(data_dir: str, name: str) -> pd.DataFrame:
    path = os.path.join(data_dir, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing file: {path}")
    return pd.read_csv(path, encoding=ENC)


def ensure_loaded(data_dir: str) -> None:
    if _CACHE["loaded"]:
        return

    start = time.time()
    try:
        ing = _read_csv(data_dir, INGREDIENTS_FILE)
        meals = _read_csv(data_dir, MEALS_FILE)

        # Basic sanity checks
        required_ing = {"ingredient_id", "ingredient_name", "kcal_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "diet_type"}
        missing_ing = required_ing - set(ing.columns)
        if missing_ing:
            raise ValueError(f"ingredients_db.csv missing columns: {sorted(missing_ing)}")

        required_meals = {"meal_id", "meal_name", "meal_type", "diet_type", "prep_time_min", "ingredients"}
        missing_meals = required_meals - set(meals.columns)
        if missing_meals:
            raise ValueError(f"meals_recipes.csv missing columns: {sorted(missing_meals)}")

        _CACHE["ingredients_df"] = ing
        _CACHE["meals_df"] = meals
        _CACHE["rows_loaded"] = {"ingredients": int(len(ing)), "meals": int(len(meals))}
        _CACHE["loaded"] = True
        _CACHE["error"] = None

    except Exception as e:
        _CACHE["loaded"] = False
        _CACHE["error"] = str(e)
        raise
    finally:
        _CACHE["load_time_sec"] = round(time.time() - start, 3)
        _CACHE["last_loaded_at"] = time.strftime("%Y-%m-%d %H:%M:%S")


def get_dfs(data_dir: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    ensure_loaded(data_dir)
    return _CACHE["ingredients_df"], _CACHE["meals_df"]


def reload_data(data_dir: str) -> None:
    _CACHE["loaded"] = False
    _CACHE["error"] = None
    _CACHE["ingredients_df"] = None
    _CACHE["meals_df"] = None
    ensure_loaded(data_dir)


def get_loader_status() -> Dict:
    return {
        "loaded": _CACHE["loaded"],
        "rows_loaded": _CACHE["rows_loaded"],
        "load_time_sec": _CACHE["load_time_sec"],
        "error": _CACHE["error"],
        "last_loaded_at": _CACHE["last_loaded_at"],
        "files": {"ingredients": INGREDIENTS_FILE, "meals": MEALS_FILE},
    }