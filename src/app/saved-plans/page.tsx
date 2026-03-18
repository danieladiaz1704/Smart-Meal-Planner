"use client";

import { useEffect, useState } from "react";

export default function SavedPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);

  const fetchPlans = async () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

    if (!currentUser?.email) return;

    const res = await fetch(
      `http://127.0.0.1:8000/saved-plans/${currentUser.email}`
    );

    const data = await res.json();

    if (data?.status === "ok") {
      setPlans(data.plans);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleDelete = async (index: number) => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

    await fetch("http://127.0.0.1:8000/delete-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: currentUser.email,
        index,
      }),
    });

    fetchPlans();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-8">
      <h1 className="text-4xl font-bold mb-8 text-green-700">
        🥗 My Saved Meal Plans
      </h1>

      {plans.length === 0 ? (
        <p className="text-gray-500">No saved plans yet.</p>
      ) : (
        plans.map((plan, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100"
          >
            {/* HEADER */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">
                Plan #{index + 1}
              </h2>

              <button
                onClick={() => handleDelete(index)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
              >
                Delete
              </button>
            </div>

            {/* DAYS */}
            {(plan?.days || []).map((day: any, i: number) => (
              <div key={i} className="mb-6">
                <h3 className="text-lg font-bold text-green-600 mb-3">
                  📅 Day {day.day}
                </h3>

                <div className="grid md:grid-cols-3 gap-4">
                  {(day.meals || []).map((meal: any, j: number) => (
                    <div
                      key={j}
                      className="bg-green-50 rounded-xl p-4 shadow-sm hover:shadow-md transition"
                    >
                      <h4 className="font-semibold text-gray-800">
                        {meal.meal_type === "breakfast" && "🍳 "}
                        {meal.meal_type === "lunch" && "🍛 "}
                        {meal.meal_type === "dinner" && "🍽️ "}
                        {meal.meal_type}
                      </h4>

                      <p className="text-sm mt-1 font-medium">
                        {meal.name}
                      </p>

                      <div className="text-xs text-gray-500 mt-2">
                        🔥 {meal.calories} kcal <br />
                        💪 {meal.protein_g}g protein <br />
                        ⏱ {meal.minutes} min
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}