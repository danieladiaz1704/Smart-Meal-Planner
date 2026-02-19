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

## How to Run the Project frontend
```bash
npm install
npm run dev

### Backend
- FastAPI
- Python
- Pandas
- CSV-based in recipes csv

cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload