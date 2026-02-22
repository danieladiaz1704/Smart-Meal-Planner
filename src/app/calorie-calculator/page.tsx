"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Sex = "female" | "male";
type Goal = "maintain" | "deficit" | "surplus";
type Activity = "sedentary" | "light" | "moderate" | "very" | "extra";

function activityMultiplier(a: Activity) {
  switch (a) {
    case "sedentary": return 1.2;
    case "light": return 1.375;
    case "moderate": return 1.55;
    case "very": return 1.725;
    case "extra": return 1.9;
  }
}

function bmr(sex: Sex, w: number, h: number, age: number) {
  const base = 10 * w + 6.25 * h - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export default function CalorieCalculator() {
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState(22);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(60);
  const [activity, setActivity] = useState<Activity>("moderate");
  const [goal, setGoal] = useState<Goal>("maintain");

  const result = useMemo(() => {
    const base = bmr(sex, weight, height, age);
    const tdee = base * activityMultiplier(activity);

    let calories = tdee;
    if (goal === "deficit") calories = tdee * 0.85;
    if (goal === "surplus") calories = tdee * 1.1;

    return {
      bmr: Math.round(base),
      tdee: Math.round(tdee),
      recommended: Math.round(calories),
    };
  }, [sex, age, height, weight, activity, goal]);

  return (
    <main className="min-h-screen bg-[#f8f1f1] p-8">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">

        {/* LEFT CARD */}
        <div className="bg-white rounded-2xl shadow p-8">
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            ← Back
          </Link>

          <h2 className="text-2xl font-bold mt-4">Calorie Calculator</h2>
          <p className="text-gray-500 mb-6">
            Estimate your daily calorie needs.
          </p>

          <div className="space-y-4">

            <input
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(+e.target.value)}
              className="w-full border rounded-xl px-4 py-2"
            />

            <input
              type="number"
              placeholder="Height (cm)"
              value={height}
              onChange={(e) => setHeight(+e.target.value)}
              className="w-full border rounded-xl px-4 py-2"
            />

            <input
              type="number"
              placeholder="Weight (kg)"
              value={weight}
              onChange={(e) => setWeight(+e.target.value)}
              className="w-full border rounded-xl px-4 py-2"
            />

            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as Activity)}
              className="w-full border rounded-xl px-4 py-2"
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Light (1–3 days/week)</option>
              <option value="moderate">Moderate (3–5 days/week)</option>
              <option value="very">Very Active</option>
              <option value="extra">Extra Active</option>
            </select>

            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
              className="w-full border rounded-xl px-4 py-2"
            >
              <option value="maintain">Maintain</option>
              <option value="deficit">Deficit</option>
              <option value="surplus">Muscle Gain</option>
            </select>
          </div>
        </div>

        {/* RIGHT CARD */}
        <div className="bg-white rounded-2xl shadow p-8">
          <h3 className="text-xl font-bold mb-4">Your Results</h3>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-100">
              <p className="text-sm text-gray-500">BMR</p>
              <p className="text-2xl font-bold">{result.bmr} kcal</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-100">
              <p className="text-sm text-gray-500">TDEE</p>
              <p className="text-2xl font-bold">{result.tdee} kcal</p>
            </div>

            <div className="p-6 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white">
              <p className="text-sm opacity-80">Recommended Calories</p>
              <p className="text-3xl font-bold">{result.recommended} kcal</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}