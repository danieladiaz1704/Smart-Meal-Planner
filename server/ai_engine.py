import json
import os
from collections import Counter
from typing import Any, Dict, List, Literal, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

DietType = Literal["vegan", "vegetarian", "non-vegetarian"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]
PrepTimePreference = Literal["any", "quick", "moderate"]
MacroPreference = Literal["balanced", "high_protein", "high_carb", "lower_carb"]

_ING_DF: Optional[pd.DataFrame] = None
_MEALS_DF: Optional[pd.DataFrame] = None
_PREF_MODEL = None
_PREF_LABEL_ENCODER = None
_FEEDBACK_MODEL = None
_META: Dict[str, Any] = {
    "loaded": False,
    "rows_loaded": {"ingredients": 0, "meals": 0},
    "data_dir": None,
    "error": None,
}

MEAL_PLANS = {
    3: (
        {"breakfast": 0.30, "lunch": 0.35, "dinner": 0.35},
        ["breakfast", "lunch", "dinner"],
    ),
    4: (
        {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snack": 0.05},
        ["breakfast", "lunch", "dinner", "snack"],
    ),
    5: (
        {
            "breakfast": 0.22,
            "lunch": 0.30,
            "dinner": 0.30,
            "snack": 0.09,
            "snack2": 0.09,
        },
        ["breakfast", "lunch", "dinner", "snack", "snack2"],
    ),
    6: (
        {
            "breakfast": 0.20,
            "lunch": 0.28,
            "dinner": 0.28,
            "snack": 0.08,
            "snack2": 0.08,
            "snack3": 0.08,
        },
        ["breakfast", "lunch", "dinner", "snack", "snack2", "snack3"],
    ),
}

NUT_KEYWORDS = {
    "nut",
    "nuts",
    "almond",
    "peanut",
    "cashew",
    "walnut",
    "pecan",
    "hazelnut",
    "pistachio",
    "macadamia",
    "brazil",
    "pine nut",
    "pine-nut",
    "almond butter",
    "peanut butter",
    "cashew butter",
}

DAIRY_KEYWORDS = {
    "milk",
    "cheese",
    "butter",
    "cream",
    "yogurt",
    "whey",
    "casein",
    "mozzarella",
    "cheddar",
    "parmesan",
    "lactose",
    "skyr",
}

ULTRA_PROCESSED_KEYWORDS = {
    "protein powder",
    "whey protein",
    "casein",
    "syrup",
    "artificial sweetener",
    "sweetener",
    "margarine",
    "processed cheese",
    "instant noodles",
    "sausage",
    "hot dog",
    "bacon bits",
    "cereal bar",
    "energy bar",
    "flavored yogurt",
    "diet soda",
    "soda",
    "soft drink",
    "chips",
    "cookies",
    "cracker",
    "crackers",
}

PROTEIN_CATEGORIES = {"protein", "legumes", "dairy", "supplements"}


def _meal_weights_and_order(meals_per_day: int) -> Tuple[Dict[str, float], List[str]]:
    meals_per_day = min(max(int(meals_per_day), 3), 6)
    return MEAL_PLANS[meals_per_day]


def _goal_params(goal: GoalType) -> Dict[str, float]:
    return {
        "gain_muscle": {
            "protein_w": 3.2,
            "cal_pen_w": 0.9,
            "fat_pen_w": 0.08,
            "time_pen_w": 0.15,
        },
        "lose_weight": {
            "protein_w": 2.6,
            "cal_pen_w": 1.2,
            "fat_pen_w": 0.12,
            "time_pen_w": 0.20,
        },
        "maintain": {
            "protein_w": 2.8,
            "cal_pen_w": 1.0,
            "fat_pen_w": 0.10,
            "time_pen_w": 0.18,
        },
    }[goal]


def _slot_meal_type(slot: str) -> str:
    return "snack" if str(slot).startswith("snack") else str(slot)


def _parse_ingredients_json(raw: str) -> List[Dict[str, Any]]:
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


def _normalize_allergies(allergies: Optional[List[str]]) -> List[str]:
    return [str(a).strip().lower() for a in (allergies or []) if str(a).strip()]


def _normalize_favorites(favorite_proteins: Optional[List[str]]) -> List[str]:
    return [str(x).strip().lower() for x in (favorite_proteins or []) if str(x).strip()]


def _normalize_text_list(values: Optional[List[str]]) -> List[str]:
    return [str(x).strip().lower() for x in (values or []) if str(x).strip()]


def _diet_allows_meal(meal_diet: str, requested: DietType) -> bool:
    meal_diet = str(meal_diet).strip().lower()
    if requested == "non-vegetarian":
        return True
    if requested == "vegetarian":
        return meal_diet in {"vegetarian", "vegan"}
    return meal_diet == "vegan"


def _favorite_protein_match(main_protein: str, favorite_proteins: Optional[List[str]]) -> int:
    mp = str(main_protein).strip().lower()
    favs = _normalize_favorites(favorite_proteins)
    return int(any(fav in mp or mp in fav for fav in favs))


def _compute_meal_macros(items: List[Dict[str, Any]], ing_df: pd.DataFrame) -> Dict[str, float]:
    idx = ing_df.set_index("ingredient_id")
    totals = {
        "calories": 0.0,
        "protein_g": 0.0,
        "carbs_g": 0.0,
        "fat_g": 0.0,
        "fiber_g": 0.0,
        "sugar_g": 0.0,
    }

    for item in items:
        ing_id = int(item["id"])
        grams = float(item["g"])
        if ing_id not in idx.index:
            continue

        row = idx.loc[ing_id]
        factor = grams / 100.0
        totals["calories"] += float(row["kcal_per_100g"]) * factor
        totals["protein_g"] += float(row["protein_per_100g"]) * factor
        totals["carbs_g"] += float(row["carbs_per_100g"]) * factor
        totals["fat_g"] += float(row["fat_per_100g"]) * factor
        totals["fiber_g"] += float(row.get("fiber_per_100g", 0.0)) * factor
        totals["sugar_g"] += float(row.get("sugar_per_100g", 0.0)) * factor

    return {k: round(v, 1) for k, v in totals.items()}


def _detect_main_protein(items: List[Dict[str, Any]], ing_df: pd.DataFrame) -> str:
    idx = ing_df.set_index("ingredient_id")
    best_name = "other"
    best_grams = 0.0

    for item in items:
        ing_id = int(item["id"])
        grams = float(item["g"])
        if ing_id not in idx.index:
            continue

        row = idx.loc[ing_id]
        category = str(row.get("category", "")).strip().lower()
        if category in PROTEIN_CATEGORIES and grams > best_grams:
            best_name = str(row.get("ingredient_name", "other")).strip().lower()
            best_grams = grams

    return best_name


def init_datasets(data_dir: str) -> None:
    global _ING_DF, _MEALS_DF, _META, _PREF_MODEL, _PREF_LABEL_ENCODER, _FEEDBACK_MODEL

    try:
        ing = pd.read_csv(f"{data_dir}/ingredients_db.csv", sep="\t")
        meals = pd.read_csv(f"{data_dir}/meals_recipes.csv", sep="\t")

        if "meal_id" in meals.columns and meals["meal_id"].astype(str).str.lower().eq("meal_id").any():
            meals = meals[~meals["meal_id"].astype(str).str.lower().eq("meal_id")].copy()

        ing["ingredient_id"] = ing["ingredient_id"].astype(int)
        meals["meal_id"] = meals["meal_id"].astype(int)
        meals["prep_time_min"] = pd.to_numeric(meals["prep_time_min"], errors="coerce").fillna(0).astype(int)
        meals["meal_type"] = meals["meal_type"].astype(str).str.strip().str.lower()
        meals["diet_type"] = meals["diet_type"].astype(str).str.strip().str.lower()

        items_list = meals["ingredients"].apply(_parse_ingredients_json)
        name_map = ing.set_index("ingredient_id")["ingredient_name"].to_dict()
        macros_df = pd.DataFrame(items_list.apply(lambda items: _compute_meal_macros(items, ing)).tolist())

        meals = pd.concat([meals.reset_index(drop=True), macros_df], axis=1)
        meals["ingredients_names"] = items_list.apply(
            lambda items: [name_map.get(int(x["id"]), f"ingredient_{x['id']}") for x in items]
        )
        meals["ingredients_lc"] = meals["ingredients_names"].apply(
            lambda xs: [str(x).lower() for x in xs]
        )
        meals["main_protein"] = items_list.apply(lambda items: _detect_main_protein(items, ing))

        model_dir = os.path.dirname(__file__)
        model_path = os.path.join(model_dir, "meal_preference_model.pkl")
        encoder_path = os.path.join(model_dir, "preference_label_encoder.pkl")
        feedback_model_path = os.path.join(model_dir, "ML", "meal_model.pkl")

        _PREF_MODEL = joblib.load(model_path) if os.path.exists(model_path) else None
        _PREF_LABEL_ENCODER = joblib.load(encoder_path) if os.path.exists(encoder_path) else None
        _FEEDBACK_MODEL = joblib.load(feedback_model_path) if os.path.exists(feedback_model_path) else None


        _ING_DF = ing
        _MEALS_DF = meals
        _META = {
            "loaded": True,
            "rows_loaded": {"ingredients": int(len(ing)), "meals": int(len(meals))},
            "data_dir": data_dir,
            "error": None,
        }

    except Exception as e:
        _ING_DF = None
        _MEALS_DF = None
        _META = {
            "loaded": False,
            "rows_loaded": {"ingredients": 0, "meals": 0},
            "data_dir": data_dir,
            "error": str(e),
        }
        raise


def get_recipe_status() -> Dict[str, Any]:
    return dict(_META)


def get_meals_dataframe() -> pd.DataFrame:
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() first.")
    return _MEALS_DF.copy()


def _row_violates_allergies(row: pd.Series, allergies: List[str]) -> bool:
    if not allergies:
        return False

    blob = " | ".join(
        [str(row.get("meal_name", "")).lower()] +
        [str(x).lower() for x in row.get("ingredients_lc", [])]
    )

    if "nuts" in allergies and any(k in blob for k in NUT_KEYWORDS):
        return True
    if "dairy" in allergies and any(k in blob for k in DAIRY_KEYWORDS):
        return True

    return any(a not in {"nuts", "dairy"} and a in blob for a in allergies)


def _row_is_ultra_processed(row: pd.Series) -> bool:
    blob = " | ".join(
        [str(row.get("meal_name", "")).lower()] +
        [str(x).lower() for x in row.get("ingredients_lc", [])]
    )
    return any(k in blob for k in ULTRA_PROCESSED_KEYWORDS)


def _row_matches_any_text(row: pd.Series, keywords: List[str]) -> bool:
    if not keywords:
        return False

    meal_name = str(row.get("meal_name", "")).lower()
    ingredients = [str(x).lower() for x in row.get("ingredients_lc", [])]

    for keyword in keywords:
        if keyword in meal_name:
            return True
        if any(keyword in ing for ing in ingredients):
            return True

    return False


def search_recipes(q: str, limit: int = 20) -> List[Dict[str, Any]]:
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() first.")

    q = str(q or "").strip().lower()
    if not q:
        return []

    df = _MEALS_DF
    hits = df[
        df["meal_name"].astype(str).str.lower().str.contains(q, na=False)
        | df["ingredients_lc"].apply(
            lambda xs: any(q in str(i) for i in xs) if isinstance(xs, list) else False
        )
    ].copy()

    hits = hits.sort_values(["protein_g", "calories"], ascending=[False, True]).head(int(limit))

    return [
        {
            "recipe_id": int(r["meal_id"]),
            "name": str(r["meal_name"]),
            "meal_type": str(r["meal_type"]),
            "minutes": int(r["prep_time_min"]),
            "calories": float(r["calories"]),
            "protein_g": float(r["protein_g"]),
            "carbs_g": float(r["carbs_g"]),
            "fat_g": float(r["fat_g"]),
            "fiber_g": float(r.get("fiber_g", 0.0)),
            "sugar_g": float(r.get("sugar_g", 0.0)),
            "diet_type": str(r["diet_type"]),
            "ingredients": r["ingredients_names"],
            "main_protein": str(r.get("main_protein", "other")),
        }
        for _, r in hits.iterrows()
    ]


def _score_row(
    row: pd.Series,
    target_cal: float,
    goal: GoalType,
    prep_time_preference: PrepTimePreference,
    macro_preference: MacroPreference,
) -> float:
    p = _goal_params(goal)

    calories = float(row["calories"])
    protein = float(row["protein_g"])
    carbs = float(row["carbs_g"])
    fat = float(row["fat_g"])
    prep_time = float(row["prep_time_min"])

    score = (
        -p["cal_pen_w"] * abs(calories - float(target_cal))
        + p["protein_w"] * protein
        - p["fat_pen_w"] * fat
        - p["time_pen_w"] * prep_time
    )

    if macro_preference == "high_protein":
        score += protein * 1.8
    elif macro_preference == "high_carb":
        score += carbs * 0.8
    elif macro_preference == "lower_carb":
        score -= carbs * 2.5

    if prep_time_preference == "quick":
        score -= prep_time * 0.8
    elif prep_time_preference == "moderate":
        score -= prep_time * 0.3

    return score


def _predict_meal_preference(
    row: pd.Series,
    goal: GoalType,
    diet_type: DietType,
    meals_per_day: int,
    prep_time_preference: PrepTimePreference,
    favorite_proteins: Optional[List[str]] = None,
) -> Dict[str, Any]:
    if _PREF_MODEL is None or _PREF_LABEL_ENCODER is None:
        return {"predicted_preference": "Unknown", "preference_score": 0.0}

    feature_row = pd.DataFrame([{
        "goal": goal,
        "diet_type_user": diet_type,
        "prep_time_preference": prep_time_preference,
        "meals_per_day": int(meals_per_day),
        "favorite_protein_match": _favorite_protein_match(
            row.get("main_protein", "other"),
            favorite_proteins,
        ),
        "diet_match": int(_diet_allows_meal(row["diet_type"], diet_type)),
        "meal_type": str(row["meal_type"]),
        "meal_diet_type": str(row["diet_type"]),
        "main_protein": str(row.get("main_protein", "other")),
        "prep_time_min": float(row["prep_time_min"]),
        "calories": float(row["calories"]),
        "protein": float(row["protein_g"]),
        "carbs": float(row["carbs_g"]),
        "fat": float(row["fat_g"]),
        "fiber": float(row.get("fiber_g", 0.0)),
        "sugar": float(row.get("sugar_g", 0.0)),
    }])

    probs = _PREF_MODEL.predict_proba(feature_row)[0]
    pred_idx = int(np.argmax(probs))
    pred_label = _PREF_LABEL_ENCODER.inverse_transform([pred_idx])[0]

    class_names = list(_PREF_LABEL_ENCODER.classes_)
    if "High" in class_names:
        pref_score = float(probs[class_names.index("High")])
    else:
        pref_score = float(probs[pred_idx])

    return {
        "predicted_preference": pred_label,
        "preference_score": round(pref_score, 4),
    }

def _predict_feedback_preference(row: pd.Series) -> float:
    if _FEEDBACK_MODEL is None:
        return 0.0

    try:
        feature_row = pd.DataFrame([{
            "calories": float(row["calories"]),
            "protein": float(row["protein_g"]),
            "carbs": float(row["carbs_g"]),
            "fat": float(row["fat_g"]),
        }])

        probs = _FEEDBACK_MODEL.predict_proba(feature_row)[0]
        classes = list(_FEEDBACK_MODEL.classes_)
        saved_index = classes.index(1)
        prob_saved = float(probs[saved_index])

        return round(prob_saved, 4)

    except Exception:
        return 0.0


def _macro_caps(slot: str, macro_preference: MacroPreference, strict: bool) -> Optional[float]:
    if macro_preference != "lower_carb":
        return None

    mt = _slot_meal_type(slot)
    caps = {
        True: {"breakfast": 30.0, "lunch": 35.0, "dinner": 35.0, "snack": 18.0},
        False: {"breakfast": 40.0, "lunch": 45.0, "dinner": 45.0, "snack": 25.0},
    }
    return caps[bool(strict)].get(mt, caps[bool(strict)]["snack"])


def _build_candidate_pool(
    base_df: pd.DataFrame,
    slot: str,
    target_cal: float,
    used_meal_ids: set,
    tol: float,
    allergies: List[str],
    exact_meal_type: bool,
) -> pd.DataFrame:
    mt = _slot_meal_type(slot)
    lo = target_cal * (1 - tol)
    hi = target_cal * (1 + tol)

    pool = base_df.copy()
    if exact_meal_type:
        pool = pool[pool["meal_type"] == mt]

    pool = pool[pool["calories"].between(lo, hi)]
    pool = pool[~pool["meal_id"].isin(list(used_meal_ids))]

    if allergies:
        pool = pool[~pool.apply(lambda r: _row_violates_allergies(r, allergies), axis=1)]

    return pool.copy()


def _pick_meal(
    base_df: pd.DataFrame,
    slot: str,
    target_cal: float,
    goal: GoalType,
    used_meal_ids: set,
    allergies: List[str],
    tol: float,
    prep_time_preference: PrepTimePreference,
    macro_preference: MacroPreference,
    strict_macro: bool,
    diet_type: DietType,
    meals_per_day: int,
    favorite_proteins: Optional[List[str]],
    likes: Optional[List[str]] = None,
    dislikes: Optional[List[str]] = None,
    favorite_meal_types: Optional[List[str]] = None,
    preferred_prep_time: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    search_steps = [
        (True, tol),
        (True, 0.30 if not slot.startswith("snack") else 0.40),
        (False, 0.35 if not slot.startswith("snack") else 0.45),
    ]

    pool = pd.DataFrame()
    for exact_meal_type, step_tol in search_steps:
        pool = _build_candidate_pool(
            base_df,
            slot,
            target_cal,
            used_meal_ids,
            step_tol,
            allergies,
            exact_meal_type,
        )
        if not pool.empty:
            break

    if pool.empty:
        return None

    dislikes = _normalize_text_list(dislikes)
    if dislikes:
        pool = pool[
            ~pool.apply(lambda r: _row_matches_any_text(r, dislikes), axis=1)
        ].copy()

        if pool.empty:
            return None

    cap = _macro_caps(slot, macro_preference, strict_macro)
    if cap is not None:
        pool = pool[pool["carbs_g"] <= cap].copy()
        if pool.empty:
            return None

    favorites_norm = _normalize_favorites(favorite_proteins)
    if favorites_norm:
        preferred_pool = pool[
            pool["main_protein"].astype(str).str.strip().str.lower().apply(
                lambda mp: any(fav in mp or mp in fav for fav in favorites_norm)
            )
        ].copy()

        if not preferred_pool.empty:
            pool = preferred_pool

    pool["base_score"] = pool.apply(
        lambda r: _score_row(r, target_cal, goal, prep_time_preference, macro_preference),
        axis=1,
    )

    ml_preds = pool.apply(
        lambda r: _predict_meal_preference(
            r,
            goal=goal,
            diet_type=diet_type,
            meals_per_day=meals_per_day,
            prep_time_preference=prep_time_preference,
            favorite_proteins=favorite_proteins,
        ),
        axis=1,
    )

    pool["predicted_preference"] = ml_preds.apply(lambda x: x["predicted_preference"])
    pool["preference_score"] = ml_preds.apply(lambda x: x["preference_score"])
    pool["feedback_score"] = pool.apply(
    lambda r: _predict_feedback_preference(r),
    axis=1,
    )
    pool["favorite_protein_match"] = pool["main_protein"].apply(
        lambda x: _favorite_protein_match(x, favorite_proteins)
    )

    likes = _normalize_text_list(likes)
    pool["likes_match"] = pool.apply(
        lambda r: int(_row_matches_any_text(r, likes)),
        axis=1,
    )

    favorite_meal_types = _normalize_text_list(favorite_meal_types)
    current_meal_type = _slot_meal_type(slot)
    pool["favorite_meal_type_match"] = pool["meal_type"].astype(str).str.lower().apply(
        lambda mt: int(mt in favorite_meal_types) if favorite_meal_types else int(mt == current_meal_type)
    )

    if preferred_prep_time is not None:
        pool["prep_time_distance"] = pool["prep_time_min"].astype(float).apply(
            lambda x: abs(x - float(preferred_prep_time))
        )
    else:
        pool["prep_time_distance"] = 0.0

    if macro_preference == "lower_carb" and strict_macro:
        ml_weight = 25.0
    elif macro_preference == "lower_carb":
        ml_weight = 45.0
    else:
        ml_weight = 100.0

    pool["score"] = (
        pool["base_score"]
        + pool["preference_score"] * ml_weight
        + pool["feedback_score"] * 40.0
        + pool["favorite_protein_match"] * 60.0
        + pool["likes_match"] * 35.0
        + pool["favorite_meal_type_match"] * 15.0
        - pool["prep_time_distance"] * 0.8
    )

    top_pool = pool.sort_values(["score", "protein_g"], ascending=[False, False]).head(5).copy()

    if top_pool.empty:
        return None

    return top_pool.sample(1).iloc[0].to_dict()


def _build_meal_payload(rec: Dict[str, Any], slot: str, target: float) -> Dict[str, Any]:
    return {
        "meal_type": str(rec["meal_type"]),
        "slot": slot,
        "recipe_id": int(rec["meal_id"]),
        "name": str(rec["meal_name"]),
        "minutes": int(rec["prep_time_min"]),
        "target_calories": round(float(target), 1),
        "calories": round(float(rec["calories"]), 1),
        "protein_g": round(float(rec["protein_g"]), 1),
        "carbs_g": round(float(rec["carbs_g"]), 1),
        "fat_g": round(float(rec["fat_g"]), 1),
        "fiber_g": round(float(rec.get("fiber_g", 0.0)), 1),
        "sugar_g": round(float(rec.get("sugar_g", 0.0)), 1),
        "predicted_preference": str(rec.get("predicted_preference", "Unknown")),
        "preference_score": round(float(rec.get("preference_score", 0.0)), 4),
        "feedback_score": round(float(rec.get("feedback_score", 0.0)), 4),
        "main_protein": str(rec.get("main_protein", "other")),
        "ingredients": rec["ingredients_names"],
        "diet_type": str(rec["diet_type"]),
    }


def build_shopping_list(plan: Dict[str, Any]) -> Dict[str, Any]:
    ctr = Counter(
        str(ing).strip().lower()
        for day in plan.get("days", [])
        for meal in day.get("meals", [])
        for ing in (meal.get("ingredients") or [])
        if str(ing).strip()
    )

    items = [{"ingredient": k, "count": int(v)} for k, v in ctr.most_common()]
    return {"total_unique": len(items), "items": items}


def generate_meal_plan(
    daily_calories: int,
    meals_per_day: int,
    days: int = 1,
    diet_type: DietType = "non-vegetarian",
    goal: GoalType = "maintain",
    allergies: Optional[List[str]] = None,
    exclude_ultra_processed: bool = False,
    variety: bool = True,
    prep_time_preference: PrepTimePreference = "any",
    macro_preference: MacroPreference = "balanced",
    favorite_proteins: Optional[List[str]] = None,
    likes: Optional[List[str]] = None,
    dislikes: Optional[List[str]] = None,
    favorite_meal_types: Optional[List[str]] = None,
    preferred_prep_time: Optional[int] = None,
) -> Dict[str, Any]:
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() on startup.")

    allergies = _normalize_allergies(allergies)
    favorite_proteins = _normalize_favorites(favorite_proteins)
    likes = _normalize_text_list(likes)
    dislikes = _normalize_text_list(dislikes)
    favorite_meal_types = _normalize_text_list(favorite_meal_types)

    weights, order = _meal_weights_and_order(meals_per_day)

    df = _MEALS_DF[_MEALS_DF["diet_type"].apply(lambda d: _diet_allows_meal(d, diet_type))].copy()

    if allergies:
        df = df[~df.apply(lambda r: _row_violates_allergies(r, allergies), axis=1)].copy()

    if dislikes:
        df = df[~df.apply(lambda r: _row_matches_any_text(r, dislikes), axis=1)].copy()

    if exclude_ultra_processed:
        df = df[~df.apply(_row_is_ultra_processed, axis=1)].copy()

    global_used = set()
    day_plans = []

    for day_idx in range(1, int(days) + 1):
        meals = []
        totals = {
            "calories": 0.0,
            "protein_g": 0.0,
            "carbs_g": 0.0,
            "fat_g": 0.0,
            "fiber_g": 0.0,
            "sugar_g": 0.0,
        }

        for i, slot in enumerate(order):
            target = float(daily_calories) * float(weights[slot])

            if i == len(order) - 1:
                remaining = max(60.0, float(daily_calories) - float(totals["calories"]))
                target = float(np.clip(remaining, 60.0, 350.0 if slot.startswith("snack") else 700.0))
                if not slot.startswith("snack"):
                    target = max(target, 220.0)

            tol = 0.12 if not slot.startswith("snack") else 0.28

            if macro_preference == "lower_carb":
                attempts = [
                    (macro_preference, True, tol, None),
                    (
                        macro_preference,
                        False,
                        0.25 if not slot.startswith("snack") else 0.35,
                        "Relaxed lower-carb fallback used",
                    ),
                    (
                        "balanced",
                        False,
                        0.30 if not slot.startswith("snack") else 0.40,
                        "Balanced fallback used",
                    ),
                ]
            else:
                attempts = [
                    (macro_preference, True, tol, None),
                    (
                        "balanced",
                        False,
                        0.30 if not slot.startswith("snack") else 0.40,
                        "Balanced fallback used",
                    ),
                ]

            rec = None
            selection_note = None

            for macro_pref, strict_macro, use_tol, note in attempts:
                used_for_pick = global_used if variety else set()

                rec = _pick_meal(
                    base_df=df,
                    slot=slot,
                    target_cal=target,
                    goal=goal,
                    used_meal_ids=used_for_pick,
                    allergies=allergies,
                    tol=use_tol,
                    prep_time_preference=prep_time_preference,
                    macro_preference=macro_pref,
                    strict_macro=strict_macro,
                    diet_type=diet_type,
                    meals_per_day=meals_per_day,
                    favorite_proteins=favorite_proteins,
                    likes=likes,
                    dislikes=dislikes,
                    favorite_meal_types=favorite_meal_types,
                    preferred_prep_time=preferred_prep_time,
                )
                if rec is not None:
                    selection_note = note
                    break

            if rec is None:
                continue

            if variety:
                global_used.add(int(rec["meal_id"]))

            payload = _build_meal_payload(rec, slot, target)

            if selection_note:
                payload["selection_note"] = selection_note

            meals.append(payload)

            for k in totals:
                totals[k] += float(rec.get(k, 0.0))

        day_plans.append({
            "day": day_idx,
            "meals": meals,
            "totals": {k: round(v, 1) for k, v in totals.items()},
        })

    overall = {
        k: round(sum(float(d["totals"].get(k, 0.0)) for d in day_plans), 1)
        for k in ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"]
    }

    plan = {
        "meta": {
            "days": int(days),
            "meals_per_day": int(meals_per_day),
            "diet_type": diet_type,
            "goal": goal,
            "exclude_ultra_processed": bool(exclude_ultra_processed),
            "variety": bool(variety),
            "allergies": allergies,
            "prep_time_preference": prep_time_preference,
            "macro_preference": macro_preference,
            "favorite_proteins": favorite_proteins,
            "likes": likes,
            "dislikes": dislikes,
            "favorite_meal_types": favorite_meal_types,
            "preferred_prep_time": preferred_prep_time,
        },
        "days": day_plans,
        "overall_totals": overall,
    }

    plan["shopping_list"] = build_shopping_list(plan)
    return plan


def replace_meal(
    daily_calories: int,
    meals_per_day: int,
    diet_type: DietType,
    goal: GoalType,
    allergies: List[str],
    exclude_ultra_processed: bool,
    variety: bool,
    prep_time_preference: PrepTimePreference = "any",
    macro_preference: MacroPreference = "balanced",
    slot: str = "lunch",
    target_meal_calories: Optional[float] = None,
    exclude_recipe_ids: Optional[List[int]] = None,
    favorite_proteins: Optional[List[str]] = None,
    likes: Optional[List[str]] = None,
    dislikes: Optional[List[str]] = None,
    favorite_meal_types: Optional[List[str]] = None,
    preferred_prep_time: Optional[int] = None,
) -> Dict[str, Any]:
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() on startup.")

    allergies = _normalize_allergies(allergies)
    favorite_proteins = _normalize_favorites(favorite_proteins)
    likes = _normalize_text_list(likes)
    dislikes = _normalize_text_list(dislikes)
    favorite_meal_types = _normalize_text_list(favorite_meal_types)

    df = _MEALS_DF[_MEALS_DF["diet_type"].apply(lambda d: _diet_allows_meal(d, diet_type))].copy()

    if allergies:
        df = df[~df.apply(lambda r: _row_violates_allergies(r, allergies), axis=1)].copy()

    if dislikes:
        df = df[~df.apply(lambda r: _row_matches_any_text(r, dislikes), axis=1)].copy()

    if exclude_ultra_processed:
        df = df[~df.apply(_row_is_ultra_processed, axis=1)].copy()

    weights, _ = _meal_weights_and_order(meals_per_day)
    target = (
        float(target_meal_calories)
        if target_meal_calories is not None
        else float(daily_calories) * float(weights.get(slot, weights.get("lunch", 0.35)))
    )

    tol = 0.12 if not slot.startswith("snack") else 0.28
    used = set(int(x) for x in (exclude_recipe_ids or []))

    if macro_preference == "lower_carb":
        attempts = [
            (macro_preference, True, tol, None),
            (
                macro_preference,
                False,
                0.25 if not slot.startswith("snack") else 0.35,
                "Relaxed lower-carb fallback used",
            ),
            (
                "balanced",
                False,
                0.30 if not slot.startswith("snack") else 0.40,
                "Balanced fallback used",
            ),
        ]
    else:
        attempts = [
            (macro_preference, True, tol, None),
            (
                "balanced",
                False,
                0.30 if not slot.startswith("snack") else 0.40,
                "Balanced fallback used",
            ),
        ]

    rec = None
    selection_note = None

    for macro_pref, strict_macro, use_tol, note in attempts:
        rec = _pick_meal(
            base_df=df,
            slot=slot,
            target_cal=target,
            goal=goal,
            used_meal_ids=used,
            allergies=allergies,
            tol=use_tol,
            prep_time_preference=prep_time_preference,
            macro_preference=macro_pref,
            strict_macro=strict_macro,
            diet_type=diet_type,
            meals_per_day=meals_per_day,
            favorite_proteins=favorite_proteins,
            likes=likes,
            dislikes=dislikes,
            favorite_meal_types=favorite_meal_types,
            preferred_prep_time=preferred_prep_time,
        )
        if rec is not None:
            selection_note = note
            break

    if rec is None:
        raise RuntimeError("No replacement meal found under current constraints.")

    payload = _build_meal_payload(rec, slot, target)
    if selection_note:
        payload["selection_note"] = selection_note

    return payload