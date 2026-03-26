import pandas as pd
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib


# ------------------------------
# 1. Conexión MongoDB
# ------------------------------
client = MongoClient(
    "mongodb+srv://sehgalishika14_db_user:nnVcP1KmQniBF6y8@cluster0.nbrnb3c.mongodb.net/meal_planner_db?retryWrites=true&w=majority",
    serverSelectionTimeoutMS=5000,
)
db = client["meal_planner_db"]
feedback_collection = db["meal_feedback"]


# ------------------------------
# 2. Cargar datos
# ------------------------------
data = list(feedback_collection.find())
df = pd.DataFrame(data)

if df.empty:
    print("No data found")
    exit()

# ------------------------------
# 3. Crear label
# ------------------------------
df["label"] = df["action"].apply(lambda x: 1 if x == "saved" else 0)


# ------------------------------
# 4. LIMPIAR DATOS IMPORTANTES
# ------------------------------
df["meal_type"] = df.get("meal_type", "unknown")
df["goal"] = df.get("goal", "maintain")
df["prep_time"] = df.get("prep_time", "any")
df["main_protein"] = df.get("main_protein", "unknown")

df["meal_type"] = df["meal_type"].astype(str).str.lower()
df["goal"] = df["goal"].astype(str).str.lower()
df["prep_time"] = df["prep_time"].astype(str).str.lower()
df["main_protein"] = df["main_protein"].astype(str).str.lower()


# ------------------------------
# 5. FEATURES
# ------------------------------
numeric_features = ["calories", "protein", "carbs", "fat"]
categorical_features = ["meal_type", "goal", "prep_time", "main_protein"]

X_numeric = df[numeric_features]
X_categorical = pd.get_dummies(df[categorical_features])

X = pd.concat([X_numeric, X_categorical], axis=1)
y = df["label"]


# ------------------------------
# 6. SPLIT
# ------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)


# ------------------------------
# 7. ENTRENAR MODELO
# ------------------------------
model = RandomForestClassifier(n_estimators=120, random_state=42)
model.fit(X_train, y_train)


# ------------------------------
# 8. EVALUACIÓN
# ------------------------------
accuracy = model.score(X_test, y_test)
print("Accuracy:", accuracy)


# ------------------------------
# 9. GUARDAR MODELO + COLUMNAS
# ------------------------------
joblib.dump(model, "meal_model.pkl")
joblib.dump(X.columns.tolist(), "meal_model_columns.pkl")

print("Model trained and saved!")