"use client";

import { useEffect, useState } from "react";

export default function SavedPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);

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
        <div className="space-y-6">
          {plans.map((plan, index) => (
            <div
              key={index}
              className="bg-white shadow-md rounded-xl p-6 border"
            >
              <h2 className="text-xl font-semibold mb-3">
                Saved Plan #{index + 1}
              </h2>

              <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(plan, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}