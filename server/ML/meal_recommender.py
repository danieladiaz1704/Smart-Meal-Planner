import os
import json
from typing import Any, Dict, List, Literal, Optional

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler


DietType = Literal["vegan", "vegetarian", "non-vegetarian"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]
PrepTimePreference = Literal["any", "quick", "moderate"]

PROTEIN_CATEGORIES = {"protein", "legumes", "dairy", "supplements"}


# -------------------------------------------------
# PATHS
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # server/
DATA_DIR = os.path.join(BASE_DIR, "data")                                # server/data
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))                   # server/ML

MEALS_FILE = os.path.join(DATA_DIR, "meals_recipes.csv")
INGREDIENTS_FILE = os.path.join(DATA_DIR, "ingredients_db.csv")

MODEL_PATH = os.path.join(MODEL_DIR, "meal_preference_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "preference_label_encoder.pkl")


# -------------------------------------------------
# HELPERS
# -------------------------------------------------
def parse_ingredients_json(raw: str) -> List[Dict[str, Any]]:
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


def compute_meal_macros(items: List[Dict[str, Any]], ing_df: pd.DataFrame) -> Dict[str, float]:
    idx = ing_df.set_index("ingredient_id")

    totals = {
        "calories": 0.0,
        "protein": 0.0,
        "carbs": 0.0,
        "fat": 0.0,
        "fiber": 0.0,
        "sugar": 0.0,
    }

    for item in items:
        ing_id = int(item["id"])
        grams = float(item["g"])

        if ing_id not in idx.index:
            continue

        row = idx.loc[ing_id]
        factor = grams / 100.0

        totals["calories"] += float(row["kcal_per_100g"]) * factor
        totals["protein"] += float(row["protein_per_100g"]) * factor
        totals["carbs"] += float(row["carbs_per_100g"]) * factor
        totals["fat"] += float(row["fat_per_100g"]) * factor
        totals["fiber"] += float(row.get("fiber_per_100g", 0.0)) * factor
        totals["sugar"] += float(row.get("sugar_per_100g", 0.0)) * factor

    return {k: round(v, 2) for k, v in totals.items()}


def detect_main_protein(items: List[Dict[str, Any]], ing_df: pd.DataFrame) -> str:
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


def diet_compatible(user_diet: DietType, meal_diet: str) -> int:
    meal_diet = str(meal_diet).strip().lower()

    if user_diet == "non-vegetarian":
        return 1
    if user_diet == "vegetarian":
        return 1 if meal_diet in {"vegetarian", "vegan"} else 0
    return 1 if meal_diet == "vegan" else 0


def favorite_protein_match(main_protein: str, favorite_proteins: Optional[List[str]]) -> int:
    mp = str(main_protein).strip().lower()
    favorites = [str(x).strip().lower() for x in (favorite_proteins or []) if str(x).strip()]
    return 1 if any(fav in mp or mp in fav for fav in favorites) else 0


def prep_match(prep_pref: PrepTimePreference, prep_time_min: int) -> int:
    if prep_pref == "any":
        return 1
    if prep_pref == "quick":
        return 1 if prep_time_min <= 15 else 0
    if prep_pref == "moderate":
        return 1 if prep_time_min <= 25 else 0
    return 0


def get_target_calories_per_meal(goal: GoalType, meals_per_day: int) -> float:
    if goal == "lose_weight":
        daily = 1700
    elif goal == "gain_muscle":
        daily = 2300
    else:
        daily = 2000

    return daily / meals_per_day


def protein_quality_for_goal(goal: GoalType, protein: float) -> int:
    if goal == "gain_muscle":
        if protein >= 30:
            return 2
        elif protein >= 20:
            return 1
        return 0

    if goal == "lose_weight":
        if protein >= 25:
            return 2
        elif protein >= 15:
            return 1
        return 0

    if protein >= 20:
        return 2
    elif protein >= 12:
        return 1
    return 0


# -------------------------------------------------
# LABEL GENERATION
# Tweaked to improve "High"
# -------------------------------------------------
def generate_label(meal_row: pd.Series, user: Dict[str, Any]) -> str:
    target_per_meal = get_target_calories_per_meal(user["goal"], user["meals_per_day"])

    calories = float(meal_row["calories"])
    protein = float(meal_row["protein"])
    carbs = float(meal_row["carbs"])
    fat = float(meal_row["fat"])
    sugar = float(meal_row["sugar"])
    prep_time = int(meal_row["prep_time_min"])

    cal_diff = abs(calories - target_per_meal)
    diet_score = diet_compatible(user["diet_type"], str(meal_row["diet_type"]))
    prep_score = prep_match(user["prep_time_preference"], prep_time)
    protein_score = protein_quality_for_goal(user["goal"], protein)
    fav_score = favorite_protein_match(meal_row["main_protein"], user["favorite_proteins"])

    if diet_score == 0:
        return "Low"

    score = 0

    if cal_diff <= 70:
        score += 2
    elif cal_diff <= 150:
        score += 1

    score += protein_score
    score += prep_score
    score += fav_score * 2

    if user["goal"] == "gain_muscle":
        if protein >= 30:
            score += 2
        elif protein >= 22:
            score += 1

        if carbs <= protein * 1.4:
            score += 1
        elif carbs > protein * 2.2:
            score -= 1

    elif user["goal"] == "lose_weight":
        if protein >= 25:
            score += 1
        if fat > 30:
            score -= 1
        if sugar > 18:
            score -= 1

    else:
        if protein >= 18:
            score += 1

    if prep_time > 30 and user["prep_time_preference"] != "any":
        score -= 1

    if score >= 6:
        return "High"
    if score >= 3:
        return "Medium"
    return "Low"


def build_user_profiles() -> List[Dict[str, Any]]:
    return [
        {
            "goal": "lose_weight",
            "diet_type": "vegan",
            "prep_time_preference": "quick",
            "meals_per_day": 4,
            "favorite_proteins": ["tofu firm", "tempeh", "lentils cooked", "chickpeas cooked"],
        },
        {
            "goal": "lose_weight",
            "diet_type": "vegetarian",
            "prep_time_preference": "quick",
            "meals_per_day": 4,
            "favorite_proteins": ["greek yogurt 0%", "skyr 0%", "egg whole", "paneer"],
        },
        {
            "goal": "lose_weight",
            "diet_type": "non-vegetarian",
            "prep_time_preference": "quick",
            "meals_per_day": 4,
            "favorite_proteins": ["chicken breast cooked", "salmon cooked", "egg whole", "canned tuna in water"],
        },
        {
            "goal": "maintain",
            "diet_type": "vegan",
            "prep_time_preference": "any",
            "meals_per_day": 3,
            "favorite_proteins": ["tofu firm", "tempeh", "seitan", "black beans cooked"],
        },
        {
            "goal": "maintain",
            "diet_type": "vegetarian",
            "prep_time_preference": "moderate",
            "meals_per_day": 3,
            "favorite_proteins": ["greek yogurt 0%", "skyr 0%", "cottage cheese 1%", "paneer"],
        },
        {
            "goal": "maintain",
            "diet_type": "non-vegetarian",
            "prep_time_preference": "moderate",
            "meals_per_day": 3,
            "favorite_proteins": ["chicken breast cooked", "turkey breast cooked", "shrimp cooked", "salmon cooked"],
        },
        {
            "goal": "gain_muscle",
            "diet_type": "vegan",
            "prep_time_preference": "any",
            "meals_per_day": 5,
            "favorite_proteins": ["tofu firm", "tempeh", "seitan", "textured vegetable protein (tvp dry)"],
        },
        {
            "goal": "gain_muscle",
            "diet_type": "vegetarian",
            "prep_time_preference": "moderate",
            "meals_per_day": 5,
            "favorite_proteins": ["greek yogurt 0%", "skyr 0%", "paneer", "whey protein powder"],
        },
        {
            "goal": "gain_muscle",
            "diet_type": "non-vegetarian",
            "prep_time_preference": "any",
            "meals_per_day": 5,
            "favorite_proteins": ["chicken breast cooked", "turkey breast cooked", "salmon cooked", "egg whole"],
        },
    ]


# -------------------------------------------------
# LOAD DATA
# -------------------------------------------------
print("Loading datasets...")
print("MEALS_FILE:", MEALS_FILE)
print("INGREDIENTS_FILE:", INGREDIENTS_FILE)

ing_df = pd.read_csv(INGREDIENTS_FILE, sep="\t")
meals_df = pd.read_csv(MEALS_FILE, sep="\t")

if "meal_id" in meals_df.columns and meals_df["meal_id"].astype(str).str.lower().eq("meal_id").any():
    meals_df = meals_df[~meals_df["meal_id"].astype(str).str.lower().eq("meal_id")].copy()

ing_df["ingredient_id"] = ing_df["ingredient_id"].astype(int)
meals_df["meal_id"] = meals_df["meal_id"].astype(int)
meals_df["prep_time_min"] = pd.to_numeric(meals_df["prep_time_min"], errors="coerce").fillna(0).astype(int)
meals_df["meal_type"] = meals_df["meal_type"].astype(str).str.strip().str.lower()
meals_df["diet_type"] = meals_df["diet_type"].astype(str).str.strip().str.lower()

items_series = meals_df["ingredients"].apply(parse_ingredients_json)

macro_df = pd.DataFrame(items_series.apply(lambda items: compute_meal_macros(items, ing_df)).tolist())
meals_df = pd.concat([meals_df.reset_index(drop=True), macro_df], axis=1)

meals_df["main_protein"] = items_series.apply(lambda items: detect_main_protein(items, ing_df))

print(f"Loaded meals: {len(meals_df)}")
print(f"Loaded ingredients: {len(ing_df)}")


# -------------------------------------------------
# BUILD TRAINING DATASET
# each row = user + meal
# -------------------------------------------------
print("Building training dataset...")

user_profiles = build_user_profiles()
training_rows: List[Dict[str, Any]] = []

for _, meal in meals_df.iterrows():
    for user in user_profiles:
        row = {
            "goal": user["goal"],
            "diet_type_user": user["diet_type"],
            "prep_time_preference": user["prep_time_preference"],
            "meals_per_day": int(user["meals_per_day"]),
            "favorite_protein_match": favorite_protein_match(
                meal["main_protein"], user["favorite_proteins"]
            ),
            "diet_match": diet_compatible(user["diet_type"], meal["diet_type"]),
            "meal_type": str(meal["meal_type"]),
            "meal_diet_type": str(meal["diet_type"]),
            "main_protein": str(meal["main_protein"]),
            "prep_time_min": int(meal["prep_time_min"]),
            "calories": float(meal["calories"]),
            "protein": float(meal["protein"]),
            "carbs": float(meal["carbs"]),
            "fat": float(meal["fat"]),
            "fiber": float(meal["fiber"]),
            "sugar": float(meal["sugar"]),
            "label": generate_label(meal, user),
        }
        training_rows.append(row)

train_df = pd.DataFrame(training_rows)

print("Training rows:", len(train_df))
print("\nLabel distribution:")
print(train_df["label"].value_counts())


# -------------------------------------------------
# TRAIN
# -------------------------------------------------
X = train_df.drop(columns=["label"])
y = train_df["label"]

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

categorical_features = [
    "goal",
    "diet_type_user",
    "prep_time_preference",
    "meal_type",
    "meal_diet_type",
    "main_protein",
]

numeric_features = [
    "meals_per_day",
    "favorite_protein_match",
    "diet_match",
    "prep_time_min",
    "calories",
    "protein",
    "carbs",
    "fat",
    "fiber",
    "sugar",
]

preprocessor = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ("num", StandardScaler(), numeric_features),
    ]
)

model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced")),
    ]
)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y_encoded,
    test_size=0.2,
    random_state=42,
    stratify=y_encoded,
)

print("\nTraining Logistic Regression...")
model.fit(X_train, y_train)


# -------------------------------------------------
# EVALUATION
# -------------------------------------------------
y_pred = model.predict(X_test)

print("\nRESULTS")
print("Accuracy:", round(accuracy_score(y_test, y_pred), 4))
print("F1 macro:", round(f1_score(y_test, y_pred, average="macro"), 4))
print("\nClassification report:")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))


# -------------------------------------------------
# SAVE
# -------------------------------------------------
os.makedirs(MODEL_DIR, exist_ok=True)

joblib.dump(model, MODEL_PATH)
joblib.dump(label_encoder, ENCODER_PATH)

print("\nSaved model to:", MODEL_PATH)
print("Saved label encoder to:", ENCODER_PATH)
print("\nDone.")