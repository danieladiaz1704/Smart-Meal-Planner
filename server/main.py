from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

from ai_engine import (
    init_datasets,
    generate_meal_plan,
    get_recipe_status,
    search_recipes,
    replace_meal,
)
from schemas import MealPlanRequest, ReplaceMealRequest

# -----------------------------
# MONGODB CONNECTION
# -----------------------------
cclient = MongoClient(
    "mongodb+srv://sehgalishika14_db_user:nnVcP1KmQniBF6y8@cluster0.nbrnb3c.mongodb.net/meal_planner_db?retryWrites=true&w=majority"
)

db = client["meal_planner_db"]

users_collection = db["users"]
plans_collection = db["plans"]

# -----------------------------
# APP CONFIG
# -----------------------------
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data"))

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
]

app = FastAPI(
    title="Smart Meal Planner API",
    version="2.0.0",
    description="FastAPI backend + ML-based meal planner",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# STARTUP
# -----------------------------
@app.on_event("startup")
def startup():
    try:
        init_datasets(DATA_DIR)
    except Exception as e:
        raise RuntimeError(f"Dataset load failed: {str(e)}")

# -----------------------------
# STATUS
# -----------------------------
@app.get("/status")
def status() -> Dict[str, Any]:
    return {
        "status": "ok",
        "datasets": get_recipe_status(),
    }

# -----------------------------
# SEARCH
# -----------------------------
@app.get("/foods/search")
def foods_search(q: str = Query(..., min_length=1), limit: int = Query(20)):
    try:
        items = search_recipes(q=q, limit=int(limit))
        return {"status": "ok", "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# GENERATE PLAN
# -----------------------------
@app.post("/generate-plan")
def generate_plan(req: MealPlanRequest):
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
            prep_time_preference=req.prep_time_preference,
            macro_preference=req.macro_preference,
        )
        return {"status": "ok", "plan": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# REPLACE MEAL
# -----------------------------
@app.post("/replace-meal")
def replace_single_meal(req: ReplaceMealRequest):
    try:
        meal = replace_meal(
            daily_calories=req.calories,
            meals_per_day=req.meals_per_day,
            diet_type=req.diet_type,
            goal=req.goal,
            allergies=req.allergies,
            exclude_ultra_processed=req.exclude_ultra_processed,
            variety=req.variety,
            prep_time_preference=req.prep_time_preference,
            macro_preference=req.macro_preference,
            slot=req.slot,
            target_meal_calories=req.target_meal_calories,
            exclude_recipe_ids=req.exclude_recipe_ids,
        )
        return {"status": "ok", "meal": meal}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# SIGNUP API
# -----------------------------
@app.post("/signup")
def signup(user: dict):
    email = user.get("email")
    password = user.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    existing_user = users_collection.find_one({"email": email})

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    users_collection.insert_one({
        "email": email,
        "password": password
    })

    return {"status": "ok", "message": "User created"}

# -----------------------------
# LOGIN API
# -----------------------------
@app.post("/login")
def login(user: dict):
    email = user.get("email")
    password = user.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    existing_user = users_collection.find_one({"email": email})

    if not existing_user:
        raise HTTPException(status_code=400, detail="User not found")

    if existing_user["password"] != password:
        raise HTTPException(status_code=400, detail="Incorrect password")

    return {
        "status": "ok",
        "user": {"email": email}
    }

# -----------------------------
# SAVE PLAN
# -----------------------------
@app.post("/save-plan")
def save_plan(data: dict):
    email = data.get("email")
    plan = data.get("plan")

    if not email or not plan:
        raise HTTPException(status_code=400, detail="Missing email or plan")

    plans_collection.insert_one({
        "email": email,
        "plan": plan
    })

    return {"status": "ok"}

# -----------------------------
# GET SAVED PLANS
# -----------------------------
@app.get("/saved-plans/{email}")
def get_saved_plans(email: str):
    plans = list(plans_collection.find({"email": email}))

    for p in plans:
        p["_id"] = str(p["_id"])

    return {
        "status": "ok",
        "plans": [p["plan"] for p in plans]
    }
# -----------------------------
# DELETE PLAN
# -----------------------------
@app.post("/delete-plan")
def delete_plan(data: dict):
    email = data.get("email")
    index = data.get("index")

    plans = list(plans_collection.find({"email": email}))

    if index < 0 or index >= len(plans):
        raise HTTPException(status_code=400, detail="Invalid index")

    plan_to_delete = plans[index]

    plans_collection.delete_one({"_id": plan_to_delete["_id"]})

    return {"status": "ok"}