"use client";

import { useEffect, useState } from "react";

export default function SavedPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);

  // 🔥 DELETE FUNCTION
  const handleDelete = async (index: number) => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

    if (!currentUser?.email) return;

    try {
      await fetch(
        `http://127.0.0.1:8000/delete-plan/${currentUser.email}/${index}`,
        { method: "DELETE" }
      );

      // update UI instantly
      setPlans((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  useEffect(() => {
    const fetchPlans = async () => {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

      if (!currentUser?.email) return;

      try {
        const res = await fetch(
          `http://127.0.0.1:8000/saved-plans/${currentUser.email}`
        );

        const data = await res.json();

        if (data?.status === "ok") {
          setPlans(data.plans);
        }
      } catch (err) {
        console.error("Error fetching plans", err);
      }
    };

    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen p-10 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">My Saved Meal Plans</h1>

      {plans.length === 0 ? (
        <p className="text-gray-600">No saved plans yet.</p>
      ) : (
        plans.map((plan, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl shadow mb-8">
            
            {/* 🔥 HEADER WITH DELETE BUTTON */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                🥗 Plan #{index + 1}
              </h2>

              <button
                onClick={() => handleDelete(index)}
                className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:opacity-90"
              >
                Delete
              </button>
            </div>

            {(plan?.days || []).map((day: any, i: number) => (
              <div key={i} className="mb-6 border-t pt-4">
                <h3 className="text-xl font-semibold mb-3">
                  📅 Day {day.day}
                </h3>

                <div className="grid md:grid-cols-3 gap-4">
                  {(day.meals || []).map((meal: any, j: number) => (
                    <div
                      key={j}
                      className="bg-gray-50 p-4 rounded-xl shadow-sm"
                    >
                      <h4 className="font-bold text-lg mb-1">
                        {meal.meal_type === "breakfast" && "🍳"}
                        {meal.meal_type === "lunch" && "🍛"}
                        {meal.meal_type === "dinner" && "🍽️"}{" "}
                        {meal.meal_type}
                      </h4>

                      <p className="text-sm font-medium">{meal.name}</p>

                      <p className="text-xs text-gray-500 mt-1">
                        ⏱ {meal.minutes} min
                      </p>

                      <div className="text-xs mt-2 text-gray-600">
                        🔥 {meal.calories} kcal <br />
                        💪 {meal.protein_g}g protein
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