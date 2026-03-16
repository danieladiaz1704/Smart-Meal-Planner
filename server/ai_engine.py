import json
import os
from collections import Counter
from typing import List, Dict, Any, Optional, Literal, Tuple

import joblib
import numpy as np
import pandas as pd

DietType = Literal["vegan", "vegetarian", "non-vegetarian"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]
PrepTimePreference = Literal["any", "quick", "moderate"]
MacroPreference = Literal["balanced", "high_protein", "high_carb", "lower_carb"]

# cache in-memory
_ING_DF: Optional[pd.DataFrame] = None
_MEALS_DF: Optional[pd.DataFrame] = None
_PREF_MODEL = None
_PREF_LABEL_ENCODER = None

_META: Dict[str, Any] = {
    "loaded": False,
    "rows_loaded": {"ingredients": 0, "meals": 0},
    "data_dir": None,
    "error": None,
}

MEAL_WEIGHTS_4 = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snack": 0.05}
MEAL_WEIGHTS_3 = {"breakfast": 0.30, "lunch": 0.35, "dinner": 0.35}
MEAL_WEIGHTS_5 = {"breakfast": 0.22, "lunch": 0.30, "dinner": 0.30, "snack": 0.09, "snack2": 0.09}
MEAL_WEIGHTS_6 = {"breakfast": 0.20, "lunch": 0.28, "dinner": 0.28, "snack": 0.08, "snack2": 0.08, "snack3": 0.08}

NUT_KEYWORDS = {
    "nut", "nuts",
    "almond", "peanut", "cashew", "walnut", "pecan", "hazelnut", "pistachio", "macadamia",
    "brazil", "pine nut", "pine-nut",
    "almond butter", "peanut butter", "cashew butter"
}
DAIRY_KEYWORDS = {
    "milk", "cheese", "butter", "cream", "yogurt", "whey", "casein",
    "mozzarella", "cheddar", "parmesan", "lactose", "skyr"
}


def _meal_weights_and_order(meals_per_day: int) -> Tuple[Dict[str, float], List[str]]:
    meals_per_day = int(meals_per_day)
    if meals_per_day >= 6:
        return MEAL_WEIGHTS_6, ["breakfast", "lunch", "dinner", "snack", "snack2", "snack3"]
    if meals_per_day == 5:
        return MEAL_WEIGHTS_5, ["breakfast", "lunch", "dinner", "snack", "snack2"]
    if meals_per_day >= 4:
        return MEAL_WEIGHTS_4, ["breakfast", "lunch", "dinner", "snack"]
    return MEAL_WEIGHTS_3, ["breakfast", "lunch", "dinner"]


def _goal_params(goal: GoalType) -> Dict[str, float]:
    if goal == "gain_muscle":
        return {"protein_w": 3.2, "cal_pen_w": 0.9, "fat_pen_w": 0.08, "time_pen_w": 0.15}
    if goal == "lose_weight":
        return {"protein_w": 2.6, "cal_pen_w": 1.2, "fat_pen_w": 0.12, "time_pen_w": 0.20}
    return {"protein_w": 2.8, "cal_pen_w": 1.0, "fat_pen_w": 0.10, "time_pen_w": 0.18}


def _diet_allows_meal(meal_diet: str, requested: DietType) -> bool:
    meal_diet = (meal_diet or "").strip().lower()
    if requested == "non-vegetarian":
        return True
    if requested == "vegetarian":
        return meal_diet in {"vegetarian", "vegan"}
    if requested == "vegan":
        return meal_diet == "vegan"
    return True


def _parse_ingredients_json(s: str) -> List[Dict[str, Any]]:
    if not isinstance(s, str) or not s.strip():
        return []
    return json.loads(s)


def _compute_meal_macros(items: List[Dict[str, Any]], ing_df: pd.DataFrame) -> Dict[str, float]:
    total_kcal = 0.0
    total_p = 0.0
    total_c = 0.0
    total_f = 0.0
    total_fiber = 0.0
    total_sugar = 0.0

    idx = ing_df.set_index("ingredient_id")

    for it in items:
        ing_id = int(it["id"])
        grams = float(it["g"])
        if ing_id not in idx.index:
            continue

        row = idx.loc[ing_id]
        factor = grams / 100.0

        total_kcal += float(row["kcal_per_100g"]) * factor
        total_p += float(row["protein_per_100g"]) * factor
        total_c += float(row["carbs_per_100g"]) * factor
        total_f += float(row["fat_per_100g"]) * factor

        if "fiber_per_100g" in row.index:
            total_fiber += float(row["fiber_per_100g"]) * factor

        if "sugar_per_100g" in row.index:
            total_sugar += float(row["sugar_per_100g"]) * factor

    return {
        "calories": round(total_kcal, 1),
        "protein_g": round(total_p, 1),
        "carbs_g": round(total_c, 1),
        "fat_g": round(total_f, 1),
        "fiber_g": round(total_fiber, 1),
        "sugar_g": round(total_sugar, 1),
    }


def init_datasets(data_dir: str) -> None:
    global _ING_DF, _MEALS_DF, _META, _PREF_MODEL, _PREF_LABEL_ENCODER

    try:
        ing_path = f"{data_dir}/ingredients_db.csv"
        meals_path = f"{data_dir}/meals_recipes.csv"

        ing = pd.read_csv(ing_path, sep="\t")
        meals = pd.read_csv(meals_path, sep="\t")

        if "meal_id" in meals.columns and meals["meal_id"].astype(str).str.lower().eq("meal_id").any():
            meals = meals[~meals["meal_id"].astype(str).str.lower().eq("meal_id")].copy()

        ing["ingredient_id"] = ing["ingredient_id"].astype(int)
        meals["meal_id"] = meals["meal_id"].astype(int)
        meals["prep_time_min"] = pd.to_numeric(meals["prep_time_min"], errors="coerce").fillna(0).astype(int)
        meals["meal_type"] = meals["meal_type"].astype(str).str.strip().str.lower()
        meals["diet_type"] = meals["diet_type"].astype(str).str.strip().str.lower()

        model_path = os.path.join(os.path.dirname(__file__), "ML", "meal_preference_model.pkl")
        encoder_path = os.path.join(os.path.dirname(__file__), "ML", "preference_label_encoder.pkl")

        if os.path.exists(model_path) and os.path.exists(encoder_path):
            _PREF_MODEL = joblib.load(model_path)
            _PREF_LABEL_ENCODER = joblib.load(encoder_path)
            print("[AI_ENGINE] ML preference model loaded successfully.")
        else:
            _PREF_MODEL = None
            _PREF_LABEL_ENCODER = None
            print("[AI_ENGINE] ML model files not found. Running without ML ranking.")

        name_map = ing.set_index("ingredient_id")["ingredient_name"].to_dict()

        computed = []
        ing_names = []
        for _, r in meals.iterrows():
            items = _parse_ingredients_json(r["ingredients"])
            macros = _compute_meal_macros(items, ing)
            computed.append(macros)
            ing_names.append([name_map.get(int(x["id"]), f"ingredient_{x['id']}") for x in items])

        macros_df = pd.DataFrame(computed)
        meals = pd.concat([meals.reset_index(drop=True), macros_df], axis=1)
        meals["ingredients_names"] = ing_names
        meals["ingredients_lc"] = meals["ingredients_names"].apply(lambda xs: [str(x).lower() for x in xs])

        _ING_DF = ing
        _MEALS_DF = meals

        _META = {
            "loaded": True,
            "rows_loaded": {"ingredients": int(len(ing)), "meals": int(len(meals))},
            "data_dir": data_dir,
            "error": None,
        }
        print(f"[AI_ENGINE] Loaded datasets: ingredients={len(ing)} meals={len(meals)}")

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


def _normalize_allergies(allergies: Optional[List[str]]) -> List[str]:
    return [str(a).strip().lower() for a in (allergies or []) if str(a).strip()]


def _row_violates_allergies(row: pd.Series, allergies: List[str]) -> bool:
    if not allergies:
        return False

    ing_list = row.get("ingredients_lc", [])
    if not isinstance(ing_list, list):
        ing_list = []

    meal_name = str(row.get("meal_name", "")).lower()
    blob = " | ".join([meal_name] + [str(x).lower() for x in ing_list])

    if "nuts" in allergies and any(k in blob for k in NUT_KEYWORDS):
        return True
    if "dairy" in allergies and any(k in blob for k in DAIRY_KEYWORDS):
        return True

    for a in allergies:
        if a in {"nuts", "dairy"}:
            continue
        if a and a in blob:
            return True

    return False


def search_recipes(q: str, limit: int = 20) -> List[Dict[str, Any]]:
    global _MEALS_DF
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() on startup.")

    q = (q or "").strip().lower()
    if not q:
        return []

    df = _MEALS_DF.copy()
    name_hit = df["meal_name"].astype(str).str.lower().str.contains(q, na=False)
    ing_hit = df["ingredients_lc"].apply(lambda xs: any(q in str(i) for i in xs) if isinstance(xs, list) else False)

    hits = df[name_hit | ing_hit].copy()
    if hits.empty:
        return []

    hits = hits.sort_values(["protein_g", "calories"], ascending=[False, True]).head(int(limit))

    out = []
    for _, r in hits.iterrows():
        out.append({
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
        })
    return out


def _score_row(
    row: pd.Series,
    target_cal: float,
    goal: GoalType,
    prep_time_preference: PrepTimePreference = "any",
    macro_preference: MacroPreference = "balanced",
) -> float:
    p = _goal_params(goal)

    calories = float(row["calories"])
    protein = float(row["protein_g"])
    carbs = float(row["carbs_g"])
    fat = float(row["fat_g"])
    prep_time = float(row["prep_time_min"])

    cal_pen = -p["cal_pen_w"] * abs(calories - float(target_cal))
    prot_score = p["protein_w"] * protein
    fat_pen = -p["fat_pen_w"] * fat
    time_pen = -p["time_pen_w"] * prep_time

    macro_bonus = 0.0
    if macro_preference == "high_protein":
        macro_bonus += protein * 1.8
    elif macro_preference == "high_carb":
        macro_bonus += carbs * 0.8
    elif macro_preference == "lower_carb":
        macro_bonus -= carbs * 2.5

    prep_bonus = 0.0
    if prep_time_preference == "quick":
        prep_bonus -= prep_time * 0.8
    elif prep_time_preference == "moderate":
        prep_bonus -= prep_time * 0.3

    return cal_pen + prot_score + fat_pen + time_pen + macro_bonus + prep_bonus


def _predict_meal_preference(row: pd.Series) -> Dict[str, Any]:
    global _PREF_MODEL, _PREF_LABEL_ENCODER

    if _PREF_MODEL is None or _PREF_LABEL_ENCODER is None:
        return {
            "predicted_preference": "Unknown",
            "preference_score": 0.0,
        }

    feature_row = pd.DataFrame([{
        "calories": float(row["calories"]),
        "protein": float(row["protein_g"]),
        "carbs": float(row["carbs_g"]),
        "fat": float(row["fat_g"]),
        "fiber": float(row.get("fiber_g", 0.0)),
        "sugar": float(row.get("sugar_g", 0.0)),
        "prep_time": float(row["prep_time_min"]),
    }])

    probs = _PREF_MODEL.predict_proba(feature_row)[0]
    pred_idx = int(np.argmax(probs))
    pred_label = _PREF_LABEL_ENCODER.inverse_transform([pred_idx])[0]

    class_names = list(_PREF_LABEL_ENCODER.classes_)
    if "High" in class_names:
        high_idx = class_names.index("High")
        pref_score = float(probs[high_idx])
    else:
        pref_score = float(probs[pred_idx])

    return {
        "predicted_preference": pred_label,
        "preference_score": round(pref_score, 4),
    }


def _slot_meal_type(slot: str) -> str:
    return "snack" if slot.startswith("snack") else slot


def _macro_caps(slot: str, macro_preference: MacroPreference, strict: bool = True) -> Optional[float]:
    if macro_preference != "lower_carb":
        return None

    mt = _slot_meal_type(slot)
    if strict:
        if mt == "breakfast":
            return 30.0
        if mt in {"lunch", "dinner"}:
            return 35.0
        return 18.0

    if mt == "breakfast":
        return 40.0
    if mt in {"lunch", "dinner"}:
        return 45.0
    return 25.0


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
    lo, hi = target_cal * (1 - tol), target_cal * (1 + tol)

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
    prep_time_preference: PrepTimePreference = "any",
    macro_preference: MacroPreference = "balanced",
    strict_macro: bool = True,
) -> Optional[Dict[str, Any]]:
    search_steps = [
        (True, tol),
        (True, 0.30 if not slot.startswith("snack") else 0.40),
        (False, 0.35 if not slot.startswith("snack") else 0.45),
    ]

    pool = pd.DataFrame()
    for exact_meal_type, step_tol in search_steps:
        pool = _build_candidate_pool(
            base_df=base_df,
            slot=slot,
            target_cal=target_cal,
            used_meal_ids=used_meal_ids,
            tol=step_tol,
            allergies=allergies,
            exact_meal_type=exact_meal_type,
        )
        if not pool.empty:
            break

    if pool.empty:
        return None

    cap = _macro_caps(slot, macro_preference, strict=strict_macro)
    if cap is not None:
        filtered = pool[pool["carbs_g"] <= cap].copy()
        if filtered.empty:
            return None
        pool = filtered

    pool["base_score"] = pool.apply(
        lambda r: _score_row(r, target_cal, goal, prep_time_preference, macro_preference),
        axis=1
    )

    ml_preds = pool.apply(_predict_meal_preference, axis=1)
    pool["predicted_preference"] = ml_preds.apply(lambda x: x["predicted_preference"])
    pool["preference_score"] = ml_preds.apply(lambda x: x["preference_score"])

    ml_weight = 100.0
    if macro_preference == "lower_carb":
        ml_weight = 25.0 if strict_macro else 45.0

    pool["score"] = pool["base_score"] + (pool["preference_score"] * ml_weight)
    pool = pool.sort_values("score", ascending=False).head(20)

    return pool.iloc[0].to_dict()


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
        "ingredients": rec["ingredients_names"],
        "diet_type": str(rec["diet_type"]),
    }


def build_shopping_list(plan: Dict[str, Any]) -> Dict[str, Any]:
    days = plan.get("days", [])
    ctr = Counter()
    for d in days:
        for m in d.get("meals", []):
            for ing in (m.get("ingredients") or []):
                s = str(ing).strip().lower()
                if s:
                    ctr[s] += 1
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
) -> Dict[str, Any]:
    global _MEALS_DF
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() on startup.")

    allergies = _normalize_allergies(allergies)
    days = int(days)

    weights, order = _meal_weights_and_order(meals_per_day)

    df = _MEALS_DF.copy()
    df = df[df["diet_type"].apply(lambda d: _diet_allows_meal(d, diet_type))].copy()

    if allergies:
        df = df[~df.apply(lambda r: _row_violates_allergies(r, allergies), axis=1)].copy()

    global_used = set()
    day_plans = []

    for day_idx in range(1, days + 1):
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
            is_last = i == len(order) - 1
            target = float(daily_calories) * float(weights[slot])

            if is_last:
                remaining = max(60.0, float(daily_calories) - float(totals["calories"]))
                if slot.startswith("snack"):
                    target = float(np.clip(remaining, 60.0, 350.0))
                else:
                    target = float(np.clip(remaining, 220.0, 700.0))

            tol = 0.12 if not slot.startswith("snack") else 0.28

            rec = _pick_meal(
                base_df=df,
                slot=slot,
                target_cal=target,
                goal=goal,
                used_meal_ids=global_used,
                allergies=allergies,
                tol=tol,
                prep_time_preference=prep_time_preference,
                macro_preference=macro_preference,
                strict_macro=True,
            )

            selection_note = None
            if rec is None and macro_preference == "lower_carb":
                rec = _pick_meal(
                    base_df=df,
                    slot=slot,
                    target_cal=target,
                    goal=goal,
                    used_meal_ids=global_used,
                    allergies=allergies,
                    tol=0.25 if not slot.startswith("snack") else 0.35,
                    prep_time_preference=prep_time_preference,
                    macro_preference=macro_preference,
                    strict_macro=False,
                )
                if rec is not None:
                    selection_note = "Relaxed lower-carb fallback used"

            if rec is None:
                rec = _pick_meal(
                    base_df=df,
                    slot=slot,
                    target_cal=target,
                    goal=goal,
                    used_meal_ids=global_used,
                    allergies=allergies,
                    tol=0.30 if not slot.startswith("snack") else 0.40,
                    prep_time_preference=prep_time_preference,
                    macro_preference="balanced",
                    strict_macro=False,
                )
                if rec is not None:
                    selection_note = "Balanced fallback used"

            if rec is None:
                continue

            global_used.add(int(rec["meal_id"]))
            meal_payload = _build_meal_payload(rec, slot, target)
            if selection_note:
                meal_payload["selection_note"] = selection_note

            meals.append(meal_payload)

            totals["calories"] += float(rec["calories"])
            totals["protein_g"] += float(rec["protein_g"])
            totals["carbs_g"] += float(rec["carbs_g"])
            totals["fat_g"] += float(rec["fat_g"])
            totals["fiber_g"] += float(rec.get("fiber_g", 0.0))
            totals["sugar_g"] += float(rec.get("sugar_g", 0.0))

        day_plans.append({
            "day": day_idx,
            "meals": meals,
            "totals": {k: round(v, 1) for k, v in totals.items()}
        })

    overall = {
        "calories": 0.0,
        "protein_g": 0.0,
        "carbs_g": 0.0,
        "fat_g": 0.0,
        "fiber_g": 0.0,
        "sugar_g": 0.0,
    }

    for dp in day_plans:
        for k in overall:
            overall[k] += float(dp["totals"].get(k, 0.0))

    plan = {
        "meta": {
            "days": days,
            "meals_per_day": int(meals_per_day),
            "diet_type": diet_type,
            "goal": goal,
            "exclude_ultra_processed": bool(exclude_ultra_processed),
            "variety": bool(variety),
            "allergies": allergies,
            "prep_time_preference": prep_time_preference,
            "macro_preference": macro_preference,
        },
        "days": day_plans,
        "overall_totals": {k: round(v, 1) for k, v in overall.items()},
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
) -> Dict[str, Any]:
    global _MEALS_DF
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() on startup.")

    allergies = _normalize_allergies(allergies)

    df = _MEALS_DF.copy()
    df = df[df["diet_type"].apply(lambda d: _diet_allows_meal(d, diet_type))].copy()

    if allergies:
        df = df[~df.apply(lambda r: _row_violates_allergies(r, allergies), axis=1)].copy()

    used = set(int(x) for x in (exclude_recipe_ids or []))

    weights, _order = _meal_weights_and_order(meals_per_day)
    default_target = float(daily_calories) * float(weights.get(slot, weights.get("lunch", 0.35)))
    target = float(target_meal_calories) if target_meal_calories is not None else default_target
    tol = 0.12 if not slot.startswith("snack") else 0.28

    rec = _pick_meal(
        base_df=df,
        slot=slot,
        target_cal=target,
        goal=goal,
        used_meal_ids=used,
        allergies=allergies,
        tol=tol,
        prep_time_preference=prep_time_preference,
        macro_preference=macro_preference,
        strict_macro=True,
    )

    selection_note = None
    if rec is None and macro_preference == "lower_carb":
        rec = _pick_meal(
            base_df=df,
            slot=slot,
            target_cal=target,
            goal=goal,
            used_meal_ids=used,
            allergies=allergies,
            tol=0.25 if not slot.startswith("snack") else 0.35,
            prep_time_preference=prep_time_preference,
            macro_preference=macro_preference,
            strict_macro=False,
        )
        if rec is not None:
            selection_note = "Relaxed lower-carb fallback used"

    if rec is None:
        rec = _pick_meal(
            base_df=df,
            slot=slot,
            target_cal=target,
            goal=goal,
            used_meal_ids=used,
            allergies=allergies,
            tol=0.30 if not slot.startswith("snack") else 0.40,
            prep_time_preference=prep_time_preference,
            macro_preference="balanced",
            strict_macro=False,
        )
        if rec is not None:
            selection_note = "Balanced fallback used"

    if rec is None:
        raise RuntimeError("No replacement meal found under current constraints.")

    payload = _build_meal_payload(rec, slot, target)
    if selection_note:
        payload["selection_note"] = selection_note
    return payload