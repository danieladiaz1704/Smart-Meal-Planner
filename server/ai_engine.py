import json
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Literal, Tuple
from collections import Counter

DietType = Literal["vegan", "vegetarian", "non-vegetarian"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]

# cache in-memory
_ING_DF: Optional[pd.DataFrame] = None
_MEALS_DF: Optional[pd.DataFrame] = None
_META: Dict[str, Any] = {"loaded": False, "rows_loaded": {"ingredients": 0, "meals": 0}, "data_dir": None, "error": None}


MEAL_WEIGHTS_4 = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snack": 0.05}
MEAL_WEIGHTS_3 = {"breakfast": 0.30, "lunch": 0.35, "dinner": 0.35}
MEAL_WEIGHTS_5 = {"breakfast": 0.22, "lunch": 0.30, "dinner": 0.30, "snack": 0.09, "snack2": 0.09}
MEAL_WEIGHTS_6 = {"breakfast": 0.20, "lunch": 0.28, "dinner": 0.28, "snack": 0.08, "snack2": 0.08, "snack3": 0.08}


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
    # weights for scoring
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
    # expects JSON list: [{"id": 1, "g": 200}, ...]
    if not isinstance(s, str) or not s.strip():
        return []
    return json.loads(s)


def _compute_meal_macros(items: List[Dict[str, Any]], ing_df: pd.DataFrame) -> Dict[str, float]:
    total_kcal = 0.0
    total_p = 0.0
    total_c = 0.0
    total_f = 0.0

    # map for speed
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

    return {
        "calories": round(total_kcal, 1),
        "protein_g": round(total_p, 1),
        "carbs_g": round(total_c, 1),
        "fat_g": round(total_f, 1),
    }


def init_datasets(data_dir: str) -> None:
    global _ING_DF, _MEALS_DF, _META

    try:
        ing_path = f"{data_dir}/ingredients_db.csv"
        meals_path = f"{data_dir}/meals_recipes.csv"

        ing = pd.read_csv(ing_path)
        meals = pd.read_csv(meals_path)

        # remove duplicated header row if accidentally present
        if "meal_id" in meals.columns and meals["meal_id"].astype(str).str.lower().eq("meal_id").any():
            meals = meals[~meals["meal_id"].astype(str).str.lower().eq("meal_id")].copy()

        # normalize types
        ing["ingredient_id"] = ing["ingredient_id"].astype(int)
        meals["meal_id"] = meals["meal_id"].astype(int)
        meals["prep_time_min"] = pd.to_numeric(meals["prep_time_min"], errors="coerce").fillna(0).astype(int)
        meals["meal_type"] = meals["meal_type"].astype(str).str.strip().str.lower()
        meals["diet_type"] = meals["diet_type"].astype(str).str.strip().str.lower()

        # precompute macros + ingredient name list for search/shopping list
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
        _META = {"loaded": False, "rows_loaded": {"ingredients": 0, "meals": 0}, "data_dir": data_dir, "error": str(e)}
        raise


def get_recipe_status() -> Dict[str, Any]:
    return dict(_META)


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
            "diet_type": str(r["diet_type"]),
            "ingredients": r["ingredients_names"],
        })
    return out


def _score_row(row: pd.Series, target_cal: float, goal: GoalType) -> float:
    p = _goal_params(goal)
    cal_pen = -p["cal_pen_w"] * abs(float(row["calories"]) - float(target_cal))
    prot = p["protein_w"] * float(row["protein_g"])
    fat_pen = -p["fat_pen_w"] * float(row["fat_g"])
    time_pen = -p["time_pen_w"] * float(row["prep_time_min"])
    return cal_pen + prot + fat_pen + time_pen


def _pick_meal(
    base_df: pd.DataFrame,
    slot: str,
    target_cal: float,
    goal: GoalType,
    used_meal_ids: set,
    tol: float,
) -> Optional[Dict[str, Any]]:
    mt = "snack" if slot.startswith("snack") else slot
    lo, hi = target_cal * (1 - tol), target_cal * (1 + tol)

    pool = base_df[
        (base_df["meal_type"] == mt)
        & (base_df["calories"].between(lo, hi))
        & (~base_df["meal_id"].isin(list(used_meal_ids)))
    ].copy()

    # fallback: wider range
    if pool.empty:
        lo2, hi2 = target_cal * 0.70, target_cal * 1.30
        pool = base_df[
            (base_df["meal_type"] == mt)
            & (base_df["calories"].between(lo2, hi2))
            & (~base_df["meal_id"].isin(list(used_meal_ids)))
        ].copy()

    if pool.empty:
        return None

    pool["score"] = pool.apply(lambda r: _score_row(r, target_cal, goal), axis=1)
    pool = pool.sort_values("score", ascending=False).head(60)

    rec = pool.sample(1).iloc[0].to_dict()
    return rec


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
    exclude_ultra_processed: bool = False,  # kept for API compatibility (unused for now)
    variety: bool = True,  # kept for API compatibility
) -> Dict[str, Any]:
    global _MEALS_DF
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() on startup.")

    allergies = [str(a).lower().strip() for a in (allergies or []) if str(a).strip()]
    days = int(days)

    weights, order = _meal_weights_and_order(meals_per_day)

    # Apply diet + allergies
    df = _MEALS_DF.copy()
    df = df[df["diet_type"].apply(lambda d: _diet_allows_meal(d, diet_type))].copy()

    if allergies:
        # simple: exclude if allergen keyword appears in ingredient names
        df = df[~df["ingredients_lc"].apply(lambda xs: any(a in " | ".join(xs) for a in allergies))].copy()

    global_used = set()
    day_plans = []

    for day_idx in range(1, days + 1):
        meals = []
        totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}

        for i, slot in enumerate(order):
            is_last = i == len(order) - 1
            target = float(daily_calories) * float(weights[slot])

            if is_last:
                remaining = max(60.0, float(daily_calories) - float(totals["calories"]))
                if slot.startswith("snack"):
                    target = float(np.clip(remaining, 60.0, 450.0))
                else:
                    target = float(np.clip(remaining, 220.0, 900.0))

            tol = 0.12 if not slot.startswith("snack") else 0.28
            rec = _pick_meal(df, slot, target, goal, used_meal_ids=global_used, tol=tol)
            if rec is None:
                continue

            global_used.add(int(rec["meal_id"]))
            meals.append(_build_meal_payload(rec, slot, target))

            totals["calories"] += float(rec["calories"])
            totals["protein_g"] += float(rec["protein_g"])
            totals["carbs_g"] += float(rec["carbs_g"])
            totals["fat_g"] += float(rec["fat_g"])

        day_plans.append({"day": day_idx, "meals": meals, "totals": {k: round(v, 1) for k, v in totals.items()}})

    overall = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
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
    slot: str,
    target_meal_calories: Optional[float],
    exclude_recipe_ids: List[int],
) -> Dict[str, Any]:
    global _MEALS_DF
    if _MEALS_DF is None:
        raise RuntimeError("Datasets not initialized. Call init_datasets() on startup.")

    allergies = [str(a).lower().strip() for a in (allergies or []) if str(a).strip()]

    df = _MEALS_DF.copy()
    df = df[df["diet_type"].apply(lambda d: _diet_allows_meal(d, diet_type))].copy()

    if allergies:
        df = df[~df["ingredients_lc"].apply(lambda xs: any(a in " | ".join(xs) for a in allergies))].copy()

    used = set(int(x) for x in (exclude_recipe_ids or []))

    weights, _order = _meal_weights_and_order(meals_per_day)
    default_target = float(daily_calories) * float(weights.get(slot, weights.get("lunch", 0.35)))
    target = float(target_meal_calories) if target_meal_calories is not None else default_target

    tol = 0.12 if not slot.startswith("snack") else 0.28
    rec = _pick_meal(df, slot, target, goal, used_meal_ids=used, tol=tol)
    if rec is None:
        raise RuntimeError("No replacement meal found under current constraints.")

    return _build_meal_payload(rec, slot, target)