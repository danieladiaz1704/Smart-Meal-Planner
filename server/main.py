from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ai_engine import (
    init_recipes,
    generate_meal_plan,
    get_recipe_status,
    search_recipes,
    replace_meal,
)
from schemas import MealPlanRequest, ReplaceMealRequest


BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data"))
RAW_RECIPES_PATH = os.path.join(DATA_DIR, "RAW_recipes.csv")

ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

app = FastAPI(
    title="Smart Meal Planner API",
    version="1.2.0",
    description="FastAPI backend + Food.com RAW_recipes.csv (goal-aware, healthier, replace-meal, explainability, shopping list).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    try:
        init_recipes(RAW_RECIPES_PATH)
    except Exception as e:
        raise RuntimeError(
            f"Failed to initialize recipe engine. Expected RAW_recipes.csv at: {RAW_RECIPES_PATH}. "
            f"Error: {str(e)}"
        )


@app.get("/status")
def status() -> Dict[str, Any]:
    return {
        "status": "ok",
        "api": {"version": "1.2.0"},
        "data_dir": DATA_DIR,
        "recipes_dataset": {"path": RAW_RECIPES_PATH, **get_recipe_status()},
    }


@app.post("/reload-dataset")
def reload_dataset() -> Dict[str, Any]:
    try:
        init_recipes(RAW_RECIPES_PATH)
        return {"status": "ok", "recipes_dataset": {"path": RAW_RECIPES_PATH, **get_recipe_status()}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reload failed: {str(e)}")


@app.get("/foods/search")
def foods_search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=50)) -> Dict[str, Any]:
    try:
        items = search_recipes(q=q, limit=int(limit))
        return {"status": "ok", "q": q, "count": len(items), "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/generate-plan")
def generate_plan(req: MealPlanRequest) -> Dict[str, Any]:
    try:
        plan = generate_meal_plan(
            daily_calories=req.calories,
            meals_per_day=req.meals_per_day,
            days=req.days,
            diet_type=req.diet_type,
            goal=req.goal,
            allergies=req.allergies,
            exclude_ultra_processed=req.exclude_ultra_processed,
            variety=req.variety,
        )
        return {"status": "ok", "plan": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to generate plan: {str(e)}")


@app.post("/replace-meal")
def replace_single_meal(req: ReplaceMealRequest) -> Dict[str, Any]:
    try:
        meal = replace_meal(
            daily_calories=req.calories,
            meals_per_day=req.meals_per_day,
            diet_type=req.diet_type,
            goal=req.goal,
            allergies=req.allergies,
            exclude_ultra_processed=req.exclude_ultra_processed,
            variety=req.variety,
            slot=req.slot,
            target_meal_calories=req.target_meal_calories,
            exclude_recipe_ids=req.exclude_recipe_ids,
        )
        return {"status": "ok", "day": req.day, "slot": req.slot, "meal": meal}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Replace meal failed: {str(e)}")
