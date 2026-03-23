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
client = MongoClient(
    "mongodb+srv://sehgalishika14_db_user:nnVcP1KmQniBF6y8@cluster0.nbrnb3c.mongodb.net/meal_planner_db?retryWrites=true&w=majority",
    serverSelectionTimeoutMS=5000,
)

db = client["meal_planner_db"]
users_collection = db["users"]
plans_collection = db["plans"]
feedback_collection = db["meal_feedback"]

# -----------------------------
# APP CONFIG
# -----------------------------
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data"))

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
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
        print("Datasets loaded successfully.")
    except Exception as e:
        print("Dataset load failed:", str(e))
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
def foods_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
):
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
            favorite_proteins=req.favorite_proteins,
            likes=req.likes,
            dislikes=req.dislikes,
            favorite_meal_types=req.favorite_meal_types,
            preferred_prep_time=req.preferred_prep_time,
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
            favorite_proteins=req.favorite_proteins,
            likes=req.likes,
            dislikes=req.dislikes,
            favorite_meal_types=req.favorite_meal_types,
            preferred_prep_time=req.preferred_prep_time,
        )
        return {"status": "ok", "meal": meal}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# SIGNUP API
# -----------------------------
@app.post("/signup")
def signup(user: dict):
    email = str(user.get("email", "")).strip().lower()
    password = str(user.get("password", "")).strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    users_collection.insert_one({
        "email": email,
        "password": password,
    })

    return {"status": "ok", "message": "User created"}


# -----------------------------
# LOGIN API
# -----------------------------
@app.post("/login")
def login(user: dict):
    email = str(user.get("email", "")).strip().lower()
    password = str(user.get("password", "")).strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    try:
        existing_user = users_collection.find_one({"email": email})
    except Exception as e:
        print("MongoDB ERROR:", str(e))
        raise HTTPException(status_code=500, detail="Database connection error")

    if not existing_user:
        raise HTTPException(status_code=400, detail="User not found")

    if existing_user.get("password") != password:
        raise HTTPException(status_code=400, detail="Incorrect password")

    return {
        "status": "ok",
        "user": {
            "email": existing_user["email"]
        }
    }


# -----------------------------
# SAVE PLAN
# -----------------------------
@app.post("/save-plan")
def save_plan(data: dict):
    email = str(data.get("email", "")).strip().lower()
    plan = data.get("plan")

    if not email or plan is None:
        raise HTTPException(status_code=400, detail="Missing email or plan")

    plans_collection.insert_one({
        "email": email,
        "plan": plan,
    })

    return {"status": "ok"}


# -----------------------------
# GET SAVED PLANS
# -----------------------------
@app.get("/saved-plans/{email}")
def get_saved_plans(email: str):
    safe_email = str(email).strip().lower()
    plans = list(plans_collection.find({"email": safe_email}))

    for p in plans:
        p["_id"] = str(p["_id"])

    return {
        "status": "ok",
        "plans": [p["plan"] for p in plans],
    }


# -----------------------------
# DELETE PLAN
# -----------------------------
@app.post("/delete-plan")
def delete_plan(data: dict):
    email = str(data.get("email", "")).strip().lower()
    index = data.get("index")

    if not email:
        raise HTTPException(status_code=400, detail="Missing email")

    if index is None or not isinstance(index, int):
        raise HTTPException(status_code=400, detail="Invalid index")

    plans = list(plans_collection.find({"email": email}))

    if index < 0 or index >= len(plans):
        raise HTTPException(status_code=400, detail="Invalid index")

    plan_to_delete = plans[index]
    plans_collection.delete_one({"_id": plan_to_delete["_id"]})

    return {"status": "ok"}
# -----------------------------
# FEEDBACK API
# -----------------------------
@app.post("/feedback")
def save_feedback(data: dict):
    try:
        feedback_collection.insert_one({
            "user_email": data.get("user_email"),
            "meal_id": data.get("meal_id"),
            "meal_name": data.get("meal_name"),
            "meal_type": data.get("meal_type"),
            "diet_type": data.get("diet_type"),
            "prep_time": data.get("prep_time"),
            "calories": data.get("calories"),
            "protein": data.get("protein"),
            "carbs": data.get("carbs"),
            "fat": data.get("fat"),
            "main_protein": data.get("main_protein"),
            "goal": data.get("goal"),
            "prep_preference": data.get("prep_preference"),
            "action": data.get("action"),
        })

        return {"status": "ok", "message": "Feedback saved successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))