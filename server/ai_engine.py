import pandas as pd
import ast
import numpy as np
from typing import List, Dict, Any, Optional, Literal, Tuple
from collections import Counter

DietType = Literal["vegetarian", "non-vegetarian"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]

HEALTHY_INCLUDES = {
    "healthy", "low-calorie", "low-fat", "low-sodium", "low-carb", "high-protein",
    "high-fiber", "gluten-free", "vegetarian", "vegan", "diabetic", "heart healthy"
}
UNHEALTHY_EXCLUDES = {
    "desserts", "cookies", "cakes", "candy", "candies", "frosting",
    "deep fry", "deep-fried", "fried", "deep-fry", "deepfry", "deep fried",
    "sweet", "sweets", "chocolate", "pie", "bars", "slab"
}

MEAL_WEIGHTS_4 = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snack": 0.05}
MEAL_WEIGHTS_3 = {"breakfast": 0.30, "lunch": 0.35, "dinner": 0.35}
MEAL_WEIGHTS_5 = {"breakfast": 0.22, "lunch": 0.30, "dinner": 0.30, "snack": 0.09, "snack2": 0.09}
MEAL_WEIGHTS_6 = {"breakfast": 0.20, "lunch": 0.28, "dinner": 0.28, "snack": 0.08, "snack2": 0.08, "snack3": 0.08}

SNACK_FALLBACK_TAGS = {"appetizers", "side-dishes"}

ULTRA_TAG_HINTS = {
    "desserts", "cookies", "cakes", "candy", "candies", "frosting", "junk food", "fast food",
    "deep-fried", "fried", "sweets", "chocolate", "pie", "quick breads", "sweet"
}
ULTRA_ING_HINTS = {
    "corn syrup", "high fructose", "hfcs", "margarine", "shortening", "processed cheese",
    "velveeta", "kraft", "cool whip", "whipped topping",
    "instant pudding", "cake mix", "cookie mix",
    "soda", "cola", "sprite", "coke",
    "hot dog", "bologna", "spam", "pepperoni", "salami",
    "cheez", "cheetos", "doritos"
}

MEAT_HINTS = {
    "chicken", "beef", "pork", "bacon", "turkey", "ham", "sausage",
    "lamb", "veal", "steak", "fish", "salmon", "tuna", "shrimp",
    "anchovy", "anchovies", "gelatin"
}

_RECIPES_DF: Optional[pd.DataFrame] = None
_RECIPES_META: Dict[str, Any] = {"loaded": False, "rows_loaded": 0, "raw_csv_path": None, "error": None}


def _safe_eval_list(s):
    if isinstance(s, list):
        return s
    try:
        return ast.literal_eval(s)
    except Exception:
        return None


def _tagset(tags) -> set:
    if not isinstance(tags, list):
        return set()
    return set(str(t).strip().lower() for t in tags)


def _infer_meal_type(ts: set) -> Optional[str]:
    if "breakfast" in ts:
        return "breakfast"
    if "lunch" in ts:
        return "lunch"
    if "snacks" in ts or "snack" in ts:
        return "snack"
    if "main-dish" in ts or "main dish" in ts or "main course" in ts:
        return "dinner"
    return None


def _is_healthy(ts: set, name: str) -> bool:
    name = (name or "").lower()
    if any(bad in name for bad in ["slab", "bar", "cookie", "cake", "frosting", "candy"]):
        return False
    if any(t in ts for t in UNHEALTHY_EXCLUDES):
        return False
    return any(t in ts for t in HEALTHY_INCLUDES)


def _contains_allergen(ingredients_lc: List[str], allergies: List[str]) -> bool:
    if not allergies:
        return False
    joined = " | ".join(ingredients_lc)
    for a in allergies:
        a = (a or "").strip().lower()
        if a and a in joined:
            return True
    return False


def _is_ultra_processed(tagset: set, ingredients_lc: List[str]) -> bool:
    if any(t in tagset for t in ULTRA_TAG_HINTS):
        return True
    joined = " | ".join(ingredients_lc)
    return any(h in joined for h in ULTRA_ING_HINTS)


def _is_vegetarian_allowed(tagset: set, ingredients_lc: List[str]) -> bool:
    if "vegetarian" in tagset or "vegan" in tagset:
        return True
    joined = " | ".join(ingredients_lc)
    return not any(h in joined for h in MEAT_HINTS)


def _goal_params(goal: GoalType) -> Dict[str, float]:
    if goal == "gain_muscle":
        return {"protein_w": 3.3, "cal_pen_w": 1.0, "sugar_pen_w": 0.75, "time_pen_w": 0.20, "fat_pen_w": 0.12}
    if goal == "lose_weight":
        return {"protein_w": 2.4, "cal_pen_w": 1.35, "sugar_pen_w": 1.0, "time_pen_w": 0.25, "fat_pen_w": 0.16}
    return {"protein_w": 2.7, "cal_pen_w": 1.10, "sugar_pen_w": 0.85, "time_pen_w": 0.22, "fat_pen_w": 0.13}


def _score_row(row, target_cal: float, goal: GoalType) -> float:
    p = _goal_params(goal)
    cal_pen = -p["cal_pen_w"] * abs(float(row["calories"]) - float(target_cal))
    prot = p["protein_w"] * float(row["protein_g"])
    time_pen = -p["time_pen_w"] * float(row["minutes"])
    sugar_pen = -p["sugar_pen_w"] * float(row["sugar_g"])
    fat_pen = -p["fat_pen_w"] * float(row["fat_g"])
    return cal_pen + prot + time_pen + sugar_pen + fat_pen


def _meal_weights_and_order(meals_per_day: int) -> Tuple[Dict[str, float], List[str]]:
    meals_per_day = int(meals_per_day)
    if meals_per_day >= 6:
        return MEAL_WEIGHTS_6, ["breakfast", "lunch", "dinner", "snack", "snack2", "snack3"]
    if meals_per_day == 5:
        return MEAL_WEIGHTS_5, ["breakfast", "lunch", "dinner", "snack", "snack2"]
    if meals_per_day >= 4:
        return MEAL_WEIGHTS_4, ["breakfast", "lunch", "dinner", "snack"]
    return MEAL_WEIGHTS_3, ["breakfast", "lunch", "dinner"]


def _passes_health_rules(row: pd.Series, mt: str) -> bool:
    mt = "snack" if mt.startswith("snack") else mt

    # Hard caps (global)
    if row["sugar_g"] > 20:
        return False
    if row["sat_fat_g"] > 10:
        return False
    if row["fat_g"] > 45:
        return False

    # Meal-specific
    if mt in {"breakfast", "lunch", "dinner"}:
        if row["sodium_mg"] > 950:
            return False
        if row["sat_fat_g"] > 8:
            return False
        if row["sugar_g"] > 15:
            return False
        if row["carbs_g"] < 10:
            return False
        return True

    # Snack
    if row["sodium_mg"] > 650:
        return False
    if row["sat_fat_g"] > 6:
        return False
    if row["sugar_g"] > 12:
        return False
    return True


def load_recipe_dataset(raw_csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(raw_csv_path)

    df["tags_list"] = df["tags"].apply(_safe_eval_list)
    df["ingredients_list"] = df["ingredients"].apply(_safe_eval_list)
    df["steps_list"] = df["steps"].apply(_safe_eval_list)
    df["nutrition_list"] = df["nutrition"].apply(_safe_eval_list)

    # Food.com nutrition: [calories, total_fat, sugar, sodium, protein, sat_fat, carbs]
    df["calories"] = df["nutrition_list"].apply(lambda x: float(x[0]) if isinstance(x, list) and len(x) > 0 else np.nan)
    df["fat_g"] = df["nutrition_list"].apply(lambda x: float(x[1]) if isinstance(x, list) and len(x) > 1 else np.nan)
    df["sugar_g"] = df["nutrition_list"].apply(lambda x: float(x[2]) if isinstance(x, list) and len(x) > 2 else np.nan)
    df["sodium_mg"] = df["nutrition_list"].apply(lambda x: float(x[3]) if isinstance(x, list) and len(x) > 3 else np.nan)
    df["protein_g"] = df["nutrition_list"].apply(lambda x: float(x[4]) if isinstance(x, list) and len(x) > 4 else np.nan)
    df["sat_fat_g"] = df["nutrition_list"].apply(lambda x: float(x[5]) if isinstance(x, list) and len(x) > 5 else np.nan)
    df["carbs_g"] = df["nutrition_list"].apply(lambda x: float(x[6]) if isinstance(x, list) and len(x) > 6 else np.nan)

    df["tagset"] = df["tags_list"].apply(_tagset)
    df["meal_type"] = df["tagset"].apply(_infer_meal_type)
    df["ingredients_lc"] = df["ingredients_list"].apply(lambda xs: [str(x).lower() for x in xs] if isinstance(xs, list) else [])

    df["is_ultra_processed"] = df.apply(lambda r: _is_ultra_processed(r["tagset"], r["ingredients_lc"]), axis=1)
    df["is_healthy"] = df.apply(lambda r: _is_healthy(r["tagset"], str(r["name"])), axis=1)

    # Macro consistency check
    df["est_cals"] = (df["protein_g"] * 4) + (df["carbs_g"] * 4) + (df["fat_g"] * 9)

    df = df[
        df["meal_type"].notna()
        & df["is_healthy"]
        & df["calories"].between(60, 1200)
        & df["protein_g"].between(0, 90)
        & df["carbs_g"].between(0, 220)
        & df["fat_g"].between(0, 80)
        & df["sugar_g"].between(0, 120)
        & df["sat_fat_g"].between(0, 40)
        & df["sodium_mg"].between(0, 5000)
        & df["minutes"].between(0, 240)
        & df["n_ingredients"].between(1, 30)
    ].copy()

    df = df[df["est_cals"].between(df["calories"] * 0.55, df["calories"] * 1.55)].copy()

    keep = [
        "id", "name", "minutes", "meal_type",
        "calories", "protein_g", "carbs_g", "fat_g", "sugar_g", "sodium_mg", "sat_fat_g",
        "ingredients_list", "steps_list", "tags_list", "ingredients_lc",
        "tagset", "is_healthy", "is_ultra_processed"
    ]
    return df[keep].reset_index(drop=True)


def init_recipes(raw_csv_path: str) -> None:
    global _RECIPES_DF, _RECIPES_META
    _RECIPES_DF = load_recipe_dataset(raw_csv_path)
    _RECIPES_META = {"loaded": True, "rows_loaded": int(len(_RECIPES_DF)), "raw_csv_path": raw_csv_path, "error": None}
    print(f"[AI_ENGINE] Loaded healthy recipe pool: {len(_RECIPES_DF)}")


def get_recipe_status() -> Dict[str, Any]:
    return dict(_RECIPES_META)


def _apply_constraints(df: pd.DataFrame, diet_type: DietType, allergies: List[str], exclude_ultra_processed: bool) -> pd.DataFrame:
    out = df
    if exclude_ultra_processed:
        out = out[~out["is_ultra_processed"]].copy()
    if diet_type == "vegetarian":
        out = out[out.apply(lambda r: _is_vegetarian_allowed(r["tagset"], r["ingredients_lc"]), axis=1)].copy()
    if allergies:
        out = out[~out["ingredients_lc"].apply(lambda ing: _contains_allergen(ing, allergies))].copy()
    return out


def search_recipes(q: str, limit: int = 20) -> List[Dict[str, Any]]:
    global _RECIPES_DF
    if _RECIPES_DF is None:
        raise RuntimeError("Recipes not initialized. Call init_recipes() on startup.")

    q = (q or "").strip().lower()
    if not q:
        return []

    df = _RECIPES_DF.copy()
    name_hit = df["name"].astype(str).str.lower().str.contains(q, na=False)
    tag_hit = df["tags_list"].apply(lambda xs: any(q in str(t).lower() for t in xs) if isinstance(xs, list) else False)
    ing_hit = df["ingredients_lc"].apply(lambda xs: any(q in str(i) for i in xs) if isinstance(xs, list) else False)

    hits = df[name_hit | tag_hit | ing_hit].copy()
    if hits.empty:
        return []

    hits = hits.sort_values(["protein_g", "calories"], ascending=[False, True]).head(int(limit))
    out = []
    for _, r in hits.iterrows():
        out.append({
            "recipe_id": int(r["id"]),
            "name": str(r["name"]),
            "meal_type": str(r["meal_type"]),
            "minutes": int(r["minutes"]) if pd.notna(r["minutes"]) else 0,
            "calories": float(r["calories"]),
            "protein_g": float(r["protein_g"]),
            "carbs_g": float(r["carbs_g"]),
            "fat_g": float(r["fat_g"]),
            "tags": r["tags_list"],
            "is_ultra_processed": bool(r["is_ultra_processed"]),
        })
    return out


def _explain(row: Dict[str, Any], target_cal: float, goal: GoalType, variety_penalty: float, meal_type: str) -> Dict[str, Any]:
    p = _goal_params(goal)
    return {
        "goal": goal,
        "meal_type": meal_type,
        "target_calories": round(float(target_cal), 1),
        "actual_calories": round(float(row["calories"]), 1),
        "calorie_delta": round(float(row["calories"]) - float(target_cal), 1),
        "protein_g": round(float(row["protein_g"]), 1),
        "sugar_g": round(float(row["sugar_g"]), 1),
        "sodium_mg": round(float(row["sodium_mg"]), 1),
        "sat_fat_g": round(float(row["sat_fat_g"]), 1),
        "variety_penalty": round(float(variety_penalty), 2),
        "weights": p,
    }


def _pick_recipe(
    base_df: pd.DataFrame,
    meal_slot: str,
    target_cal: float,
    goal: GoalType,
    used_ids: set,
    used_ingredients: set,
    variety: bool,
    tol: float
) -> Optional[Dict[str, Any]]:
    mt = "snack" if meal_slot.startswith("snack") else meal_slot
    lo, hi = target_cal * (1 - tol), target_cal * (1 + tol)

    pool = base_df[
        (base_df["meal_type"] == mt)
        & (base_df["calories"].between(lo, hi))
        & (~base_df["id"].isin(list(used_ids)))
    ].copy()

    if not pool.empty:
        pool = pool[pool.apply(lambda r: _passes_health_rules(r, mt), axis=1)].copy()

    if pool.empty and mt == "snack":
        pool = base_df[
            base_df["tagset"].apply(lambda ts: len(SNACK_FALLBACK_TAGS.intersection(ts)) > 0)
            & (base_df["calories"].between(lo, hi))
            & (~base_df["id"].isin(list(used_ids)))
        ].copy()
        if not pool.empty:
            pool = pool[pool.apply(lambda r: _passes_health_rules(r, mt), axis=1)].copy()

    if pool.empty:
        lo2, hi2 = target_cal * 0.70, target_cal * 1.30
        pool = base_df[
            (base_df["meal_type"] == mt)
            & (base_df["calories"].between(lo2, hi2))
            & (~base_df["id"].isin(list(used_ids)))
        ].copy()
        if not pool.empty:
            pool = pool[pool.apply(lambda r: _passes_health_rules(r, mt), axis=1)].copy()

    if pool.empty:
        return None

    if variety and used_ingredients:
        def overlap_penalty(ing_lc: List[str]) -> float:
            if not ing_lc:
                return 0.0
            return float(len(set(ing_lc).intersection(used_ingredients)))
        pool["variety_penalty"] = pool["ingredients_lc"].apply(overlap_penalty)
    else:
        pool["variety_penalty"] = 0.0

    pool["score"] = pool.apply(lambda r: _score_row(r, target_cal, goal), axis=1) - (1.15 * pool["variety_penalty"])
    pool = pool.sort_values("score", ascending=False).head(80)

    rec = pool.sample(1).iloc[0].to_dict()
    rec["_variety_penalty"] = float(rec.get("variety_penalty", 0.0))
    return rec


def _build_meal_payload(rec: Dict[str, Any], slot: str, target: float, goal: GoalType) -> Dict[str, Any]:
    meal_type = "snack" if slot.startswith("snack") else slot
    explain = _explain(rec, target, goal, float(rec.get("_variety_penalty", 0.0)), meal_type)
    return {
        "meal_type": meal_type,
        "slot": slot,
        "recipe_id": int(rec["id"]),
        "name": str(rec["name"]),
        "minutes": int(rec["minutes"]) if pd.notna(rec["minutes"]) else 0,
        "target_calories": round(float(target), 1),
        "calories": round(float(rec["calories"]), 1),
        "protein_g": round(float(rec["protein_g"]), 1),
        "carbs_g": round(float(rec["carbs_g"]), 1),
        "fat_g": round(float(rec["fat_g"]), 1),
        "ingredients": rec["ingredients_list"],
        "steps": rec["steps_list"],
        "tags": rec["tags_list"],
        "is_ultra_processed": bool(rec["is_ultra_processed"]),
        "explain": explain,
    }


def _build_day_plan(
    daily_calories: int,
    meals_per_day: int,
    diet_type: DietType,
    goal: GoalType,
    allergies: List[str],
    exclude_ultra_processed: bool,
    variety: bool,
    global_used_ids: set,
    global_used_ingredients: set,
) -> Dict[str, Any]:
    global _RECIPES_DF
    if _RECIPES_DF is None:
        raise RuntimeError("Recipes not initialized. Call init_recipes() on startup.")

    base_df = _apply_constraints(_RECIPES_DF, diet_type=diet_type, allergies=allergies, exclude_ultra_processed=exclude_ultra_processed)
    weights, order = _meal_weights_and_order(meals_per_day)

    meals = []
    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}

    day_used_ids = set()
    day_used_ingredients = set()

    def slot_tol(slot: str, is_last: bool) -> float:
        if is_last:
            return 0.08
        if slot.startswith("snack"):
            return 0.28
        return 0.12

    for idx, slot in enumerate(order):
        is_last = idx == (len(order) - 1)
        target = float(daily_calories) * float(weights[slot])

        if is_last:
            remaining = max(60.0, float(daily_calories) - float(totals["calories"]))
            if slot.startswith("snack"):
                target = float(np.clip(remaining, 60.0, 350.0))
            else:
                target = float(np.clip(remaining, 220.0, 750.0))

        rec = _pick_recipe(
            base_df=base_df,
            meal_slot=slot,
            target_cal=target,
            goal=goal,
            used_ids=global_used_ids.union(day_used_ids),
            used_ingredients=global_used_ingredients.union(day_used_ingredients),
            variety=variety,
            tol=slot_tol(slot, is_last),
        )

        if rec is None:
            continue

        # if over budget, try a few lower-calorie picks
        tries = 0
        while (float(totals["calories"]) + float(rec["calories"])) > (float(daily_calories) * 1.05) and tries < 5:
            alt = _pick_recipe(
                base_df=base_df,
                meal_slot=slot,
                target_cal=max(60.0, target * 0.85),
                goal=goal,
                used_ids=global_used_ids.union(day_used_ids),
                used_ingredients=global_used_ingredients.union(day_used_ingredients),
                variety=variety,
                tol=max(0.08, slot_tol(slot, is_last) * 1.10),
            )
            if alt is None:
                break
            rec = alt
            tries += 1

        day_used_ids.add(rec["id"])
        if variety:
            day_used_ingredients.update(set(rec.get("ingredients_lc", [])))

        meals.append(_build_meal_payload(rec, slot, target, goal))

        totals["calories"] += float(rec["calories"])
        totals["protein_g"] += float(rec["protein_g"])
        totals["carbs_g"] += float(rec["carbs_g"])
        totals["fat_g"] += float(rec["fat_g"])

    global_used_ids.update(day_used_ids)
    if variety:
        global_used_ingredients.update(day_used_ingredients)
        if len(global_used_ingredients) > 600:
            global_used_ingredients = set(list(global_used_ingredients)[-600:])

    return {"meals": meals, "totals": {k: round(v, 1) for k, v in totals.items()}}


def build_shopping_list(plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aggregates ingredients across all days.
    Returns counts + a sorted list.
    """
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
) -> Dict[str, Any]:
    allergies = allergies or []
    days = int(days)

    global_used_ids = set()
    global_used_ingredients = set()

    day_plans = []
    for day_idx in range(1, days + 1):
        day_plan = _build_day_plan(
            daily_calories=int(daily_calories),
            meals_per_day=int(meals_per_day),
            diet_type=diet_type,
            goal=goal,
            allergies=allergies,
            exclude_ultra_processed=bool(exclude_ultra_processed),
            variety=bool(variety),
            global_used_ids=global_used_ids,
            global_used_ingredients=global_used_ingredients,
        )
        day_plans.append({"day": day_idx, **day_plan})

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
    """
    Picks a single replacement meal under the same constraints.
    """
    global _RECIPES_DF
    if _RECIPES_DF is None:
        raise RuntimeError("Recipes not initialized. Call init_recipes() on startup.")

    base_df = _apply_constraints(_RECIPES_DF, diet_type=diet_type, allergies=allergies, exclude_ultra_processed=exclude_ultra_processed)

    weights, _order = _meal_weights_and_order(meals_per_day)
    default_target = float(daily_calories) * float(weights.get(slot, weights.get("lunch", 0.35)))

    target = float(target_meal_calories) if target_meal_calories is not None else default_target

    used_ids = set(int(x) for x in (exclude_recipe_ids or []))
    used_ingredients = set()  # UI-level variety handled via exclude ids; keep simple

    rec = _pick_recipe(
        base_df=base_df,
        meal_slot=slot,
        target_cal=target,
        goal=goal,
        used_ids=used_ids,
        used_ingredients=used_ingredients,
        variety=variety,
        tol=0.12 if not slot.startswith("snack") else 0.28,
    )

    if rec is None:
        raise RuntimeError("No replacement meal found under current constraints.")

    return _build_meal_payload(rec, slot, target, goal)
