# Smart-Meal-Planner

The Smart Meal Planner is a web-based application designed to demonstrate how AI-driven decision logic can assist users in generating structured and personalized meal plans.

## Project Overview
This project focuses on the frontend interface where users can input dietary preferences, goals, calorie targets, allergies, and preparation constraints. The meal plan is displayed on a separate page using mock data. Backend services and AI recommendation logic will be integrated in later stages.

## Features
- Responsive salmon-themed UI
- User preference form (diet type, goals, calories, allergies, meals per day)
- Separate Meal Plan results page
- Built with modern web technologies

## Tech Stack

### Frontend
- Next.js (React + TypeScript)
- Tailwind CSS

## Running the Project

### 1. Install backend dependencies
cd server
pip install pandas scikit-learn joblib

### 2. Train the ML preference model (run once)
python ML/meal_preference_model.py

This will generate:
- server/ML/meal_preference_model.pkl
- server/ML/preference_label_encoder.pkl

### 3. Start the backend
python -m uvicorn main:app --reload

### 4. Start the frontend
cd smart-meal-planner-frontend
npm install
npm run dev