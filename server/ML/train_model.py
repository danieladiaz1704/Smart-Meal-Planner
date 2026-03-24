import pandas as pd
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib


client = MongoClient(
    "mongodb+srv://sehgalishika14_db_user:nnVcP1KmQniBF6y8@cluster0.nbrnb3c.mongodb.net/meal_planner_db?retryWrites=true&w=majority",
    serverSelectionTimeoutMS=5000,
)
db = client["meal_planner_db"]
feedback_collection = db["meal_feedback"]


data = list(feedback_collection.find())

df = pd.DataFrame(data)

if df.empty:
    print("No data found")
    exit()

df["label"] = df["action"].apply(lambda x: 1 if x == "saved" else 0)


features = ["calories", "protein", "carbs", "fat"]

X = df[features]
y = df["label"]


X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)


model = RandomForestClassifier()
model.fit(X_train, y_train)


accuracy = model.score(X_test, y_test)
print("Accuracy:", accuracy)


joblib.dump(model, "meal_model.pkl")

print("Model trained and saved!")