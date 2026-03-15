import pandas as pd
import json
import os
import joblib

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report

# -----------------------------
# Paths
# -----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

ingredients_path = os.path.join(BASE_DIR, "data", "ingredients_db.csv")
meals_path = os.path.join(BASE_DIR, "data", "meals_recipes.csv")

model_output_path = os.path.join(os.path.dirname(__file__), "meal_preference_model.pkl")
label_output_path = os.path.join(os.path.dirname(__file__), "preference_label_encoder.pkl")
dataset_output_path = os.path.join(BASE_DIR, "data", "meal_ml_dataset.csv")

# -----------------------------
# Load data
# -----------------------------
ingredients = pd.read_csv(ingredients_path, sep="\t")
meals = pd.read_csv(meals_path, sep="\t")

print("Ingredients columns:", ingredients.columns.tolist())
print("Meals columns:", meals.columns.tolist())

ingredient_map = ingredients.set_index("ingredient_id")

# -----------------------------
# Build meal-level dataset
# -----------------------------
rows = []

for _, meal in meals.iterrows():
    ingredients_list = json.loads(meal["ingredients"])

    totals = {
        "calories": 0.0,
        "protein": 0.0,
        "carbs": 0.0,
        "fat": 0.0,
        "fiber": 0.0,
        "sugar": 0.0,
    }

    for item in ingredients_list:
        ing_id = item["id"]
        grams = item["g"]

        ing = ingredient_map.loc[ing_id]
        factor = grams / 100.0

        totals["calories"] += ing["kcal_per_100g"] * factor
        totals["protein"] += ing["protein_per_100g"] * factor
        totals["carbs"] += ing["carbs_per_100g"] * factor
        totals["fat"] += ing["fat_per_100g"] * factor

        if "fiber_per_100g" in ingredients.columns:
            totals["fiber"] += ing["fiber_per_100g"] * factor

        if "sugar_per_100g" in ingredients.columns:
            totals["sugar"] += ing["sugar_per_100g"] * factor

    rows.append({
        "meal_id": meal["meal_id"],
        "meal_name": meal["meal_name"],
        "meal_type": meal["meal_type"],
        "diet_type": meal["diet_type"],
        "prep_time": meal["prep_time_min"],
        "calories": round(totals["calories"], 2),
        "protein": round(totals["protein"], 2),
        "carbs": round(totals["carbs"], 2),
        "fat": round(totals["fat"], 2),
        "fiber": round(totals["fiber"], 2),
        "sugar": round(totals["sugar"], 2),
    })

df = pd.DataFrame(rows)

# -----------------------------
# Create baseline preference label
# -----------------------------
def assign_preference(row):
    calories = row["calories"]
    protein = row["protein"]
    fiber = row["fiber"]
    sugar = row["sugar"]
    prep_time = row["prep_time"]

    if (
        protein >= 20
        and 300 <= calories <= 700
        and fiber >= 4
        and sugar <= 20
        and prep_time <= 30
    ):
        return "High"
    elif (
        protein >= 12
        and 250 <= calories <= 850
    ):
        return "Medium"
    else:
        return "Low"

df["preference"] = df.apply(assign_preference, axis=1)

# Save dataset for inspection
df.to_csv(dataset_output_path, index=False)

print("meal_ml_dataset.csv created successfully")
print("\nPreference distribution:")
print(df["preference"].value_counts())

# -----------------------------
# Train ML model
# -----------------------------
features = [
    "calories",
    "protein",
    "carbs",
    "fat",
    "fiber",
    "sugar",
    "prep_time"
]

X = df[features]
y = df["preference"]

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y_encoded,
    test_size=0.2,
    random_state=42,
    stratify=y_encoded
)

model = LogisticRegression(max_iter=3000)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)

print("\nModel evaluation:")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))

# -----------------------------
# Save model
# -----------------------------
joblib.dump(model, model_output_path)
joblib.dump(label_encoder, label_output_path)

print("\nModel saved successfully:")
print(model_output_path)
print(label_output_path)