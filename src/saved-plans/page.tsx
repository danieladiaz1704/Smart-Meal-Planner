"use client";

import { useEffect, useState } from "react";

export default function SavedPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const savedPlans = JSON.parse(localStorage.getItem("savedPlans") || "{}");

    if (currentUser?.email && savedPlans[currentUser.email]) {
      setPlans(savedPlans[currentUser.email]);
    }
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