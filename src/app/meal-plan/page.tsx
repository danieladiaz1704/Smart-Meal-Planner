"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://smart-meal-planner-1-2c4l.onrender.com";

type Meal = {
  meal_type: string;
  slot: string;
  recipe_id: number;
  name: string;
  minutes: number;
  target_calories: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  predicted_preference?: string;
  preference_score?: number;
  main_protein?: string;
  ingredients?: string[];
  diet_type?: string;
  selection_note?: string;
};

type DayPlan = {
  day: number;
  meals: Meal[];
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
  };
};

type PlanData = {
  meta?: {
    days: number;
    meals_per_day: number;
    diet_type: string;
    goal: string;
    exclude_ultra_processed: boolean;
    variety: boolean;
    allergies: string[];
    prep_time_preference: string;
    macro_preference: string;
    favorite_proteins: string[];
    likes?: string[];
    dislikes?: string[];
    favorite_meal_types?: string[];
    preferred_prep_time?: number | null;
  };
  days: DayPlan[];
  overall_totals?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
  };
  shopping_list?: {
    total_unique: number;
    items: { ingredient: string; count: number }[];
  };
};

type PlanResponse = {
  status: "ok";
  plan: PlanData;
};

type RequestPayload = {
  calories: number;
  meals_per_day: number;
  days: number;
  diet_type: "vegan" | "vegetarian" | "non-vegetarian";
  goal: "lose_weight" | "maintain" | "gain_muscle";
  allergies: string[];
  exclude_ultra_processed: boolean;
  variety: boolean;
  prep_time_preference: "any" | "quick" | "moderate";
  macro_preference: "balanced" | "high_protein" | "high_carb" | "lower_carb";
  favorite_proteins: string[];
  likes: string[];
  dislikes: string[];
  favorite_meal_types: string[];
  preferred_prep_time?: number | null;
};

export default function MealPlanPage() {
  const router = useRouter();

  const [requestData, setRequestData] = useState<RequestPayload | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      router.push("/login");
      return;
    }

    const savedRequest = sessionStorage.getItem("mealPlanRequest");
    const savedResult = sessionStorage.getItem("mealPlanResult");

    if (!savedRequest || !savedResult) {
      router.push("/planner");
      return;
    }

    try {
      const parsedRequest = JSON.parse(savedRequest);
      const parsedResult = JSON.parse(savedResult);

      setRequestData(parsedRequest);
      setResult(parsedResult);
      setActiveDay(1);
    } catch {
      router.push("/planner");
    }
  }, [router]);

  const days = result?.plan?.days ?? [];
  const activeDayObj = useMemo(
    () => days.find((d) => d.day === activeDay) ?? days[0] ?? null,
    [days, activeDay]
  );

  const persistResult = (next: PlanResponse) => {
    setResult(next);
    sessionStorage.setItem("mealPlanResult", JSON.stringify(next));
  };

  const handleSavePlan = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

      if (!currentUser?.email || !result?.plan) {
        alert("No plan to save");
        return;
      }

      const res = await fetch(`${API_BASE}/save-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentUser.email,
          plan: result.plan,
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.status !== "ok") {
        throw new Error(data?.detail || "Failed to save plan");
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to save plan");
    }
  };

  const handleReplace = async (slot: string, target: number, currentRecipeId: number) => {
    if (!result?.plan || !activeDayObj || !requestData) return;

    setError(null);

    try {
      const excludeIds = (activeDayObj.meals ?? [])
        .map((m) => Number(m.recipe_id))
        .filter((id) => Number.isFinite(id));

      if (!excludeIds.includes(Number(currentRecipeId))) {
        excludeIds.push(Number(currentRecipeId));
      }

      const payload = {
        calories: requestData.calories,
        meals_per_day: requestData.meals_per_day,
        diet_type: requestData.diet_type,
        goal: requestData.goal,
        allergies: requestData.allergies ?? [],
        exclude_ultra_processed: requestData.exclude_ultra_processed ?? false,
        variety: requestData.variety ?? true,
        prep_time_preference: requestData.prep_time_preference ?? "any",
        macro_preference: requestData.macro_preference ?? "balanced",
        favorite_proteins: requestData.favorite_proteins ?? [],
        likes: requestData.likes ?? [],
        dislikes: requestData.dislikes ?? [],
        favorite_meal_types: requestData.favorite_meal_types ?? [],
        preferred_prep_time: requestData.preferred_prep_time ?? null,
        day: activeDay,
        slot,
        target_meal_calories: Number(target),
        exclude_recipe_ids: excludeIds,
      };

      const res = await fetch(`${API_BASE}/replace-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data?.status !== "ok") {
        throw new Error(data?.detail ?? "Replace failed");
      }

      const newMeal: Meal = data.meal;

      const newDays = (result.plan.days ?? []).map((d) => {
        if (d.day !== activeDay) return d;

        const updatedMeals = (d.meals ?? []).map((mm) =>
          (mm.slot ?? mm.meal_type) === slot ? newMeal : mm
        );

        const totals = updatedMeals.reduce(
          (acc, mm) => {
            acc.calories += Number(mm.calories || 0);
            acc.protein_g += Number(mm.protein_g || 0);
            acc.carbs_g += Number(mm.carbs_g || 0);
            acc.fat_g += Number(mm.fat_g || 0);
            acc.fiber_g += Number(mm.fiber_g || 0);
            acc.sugar_g += Number(mm.sugar_g || 0);
            return acc;
          },
          {
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            fiber_g: 0,
            sugar_g: 0,
          }
        );

        return {
          ...d,
          meals: updatedMeals,
          totals: {
            calories: Number(totals.calories.toFixed(1)),
            protein_g: Number(totals.protein_g.toFixed(1)),
            carbs_g: Number(totals.carbs_g.toFixed(1)),
            fat_g: Number(totals.fat_g.toFixed(1)),
            fiber_g: Number(totals.fiber_g.toFixed(1)),
            sugar_g: Number(totals.sugar_g.toFixed(1)),
          },
        };
      });

      const overall = newDays.reduce(
        (acc, d) => {
          acc.calories += Number(d.totals?.calories || 0);
          acc.protein_g += Number(d.totals?.protein_g || 0);
          acc.carbs_g += Number(d.totals?.carbs_g || 0);
          acc.fat_g += Number(d.totals?.fat_g || 0);
          acc.fiber_g += Number(d.totals?.fiber_g || 0);
          acc.sugar_g += Number(d.totals?.sugar_g || 0);
          return acc;
        },
        {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          sugar_g: 0,
        }
      );

      const ctr = new Map<string, number>();

      for (const d of newDays) {
        for (const mm of d.meals ?? []) {
          for (const ing of mm.ingredients ?? []) {
            const k = String(ing).trim().toLowerCase();
            if (!k) continue;
            ctr.set(k, (ctr.get(k) ?? 0) + 1);
          }
        }
      }

      const shoppingItems = Array.from(ctr.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([ingredient, count]) => ({ ingredient, count }));

      const next: PlanResponse = {
        ...result,
        plan: {
          ...result.plan,
          days: newDays,
          overall_totals: {
            calories: Number(overall.calories.toFixed(1)),
            protein_g: Number(overall.protein_g.toFixed(1)),
            carbs_g: Number(overall.carbs_g.toFixed(1)),
            fat_g: Number(overall.fat_g.toFixed(1)),
            fiber_g: Number(overall.fiber_g.toFixed(1)),
            sugar_g: Number(overall.sugar_g.toFixed(1)),
          },
          shopping_list: {
            total_unique: shoppingItems.length,
            items: shoppingItems,
          },
        },
      };

      persistResult(next);
    } catch (e: any) {
      setError(e?.message ?? "Replace failed");
    }
  };

  if (!result?.plan) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50 text-slate-900">
        <div className="mx-auto max-w-4xl px-5 py-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-lg font-extrabold">No plan found</p>
            <p className="text-sm text-slate-600 mt-2">
              Generate a plan first.
            </p>
            <button
              onClick={() => router.push("/planner")}
              className="mt-4 rounded-2xl px-5 py-3 bg-rose-600 text-white font-bold"
            >
              Go to Planner
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-rose-200/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/planner")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-semibold hover:border-rose-200 transition"
          >
            ← Edit questions
          </button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <p className="text-sm font-semibold text-rose-700">Meal Plan Results</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-2xl">
            {error}
          </div>
        )}

        <section className="min-w-0 overflow-hidden">
          <div className="rounded-3xl border border-slate-200 bg-white/85 backdrop-blur shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">Today snapshot</p>
                <h2 className="text-2xl font-extrabold">
                  {activeDayObj
                    ? `Day ${activeDayObj.day} • ${activeDayObj.totals?.calories ?? 0} kcal`
                    : "No plan yet"}
                </h2>

                <button
                  onClick={handleSavePlan}
                  className="mt-3 px-5 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition"
                >
                  Save Plan
                </button>
              </div>

              {days.length > 0 && (
                <div className="flex items-center gap-2">
                  {days.map((d) => (
                    <button
                      key={d.day}
                      onClick={() => setActiveDay(d.day)}
                      className={[
                        "rounded-full px-4 py-2 text-sm font-bold border transition",
                        activeDay === d.day
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-rose-200",
                      ].join(" ")}
                    >
                      Day {d.day}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 space-y-4 overflow-hidden">
              {!activeDayObj ? (
                <EmptyState />
              ) : (
                <>
                  {(activeDayObj.meals ?? []).map((m, idx) => (
                    <MealCard
                      key={`${m.recipe_id}-${idx}`}
                      meal={m}
                      index={idx + 1}
                      onReplace={handleReplace}
                    />
                  ))}

                  <div className="grid sm:grid-cols-3 gap-3 pt-2">
                    <Stat title="Protein" value={`${activeDayObj.totals?.protein_g ?? 0} g`} />
                    <Stat title="Carbs" value={`${activeDayObj.totals?.carbs_g ?? 0} g`} />
                    <Stat title="Fat" value={`${activeDayObj.totals?.fat_g ?? 0} g`} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold text-slate-700">Explainability</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Rule-Based Filtering + Goal-Aware Ranking + Machine Learning
                      Preference Score + User Macro / Prep Preferences
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {result?.plan?.overall_totals && (
            <div className="grid sm:grid-cols-4 gap-3 mt-4">
              <Stat title="Plan calories" value={`${result.plan.overall_totals.calories} kcal`} />
              <Stat title="Protein" value={`${result.plan.overall_totals.protein_g} g`} />
              <Stat title="Carbs" value={`${result.plan.overall_totals.carbs_g} g`} />
              <Stat title="Fat" value={`${result.plan.overall_totals.fat_g} g`} />
            </div>
          )}

          {result?.plan?.shopping_list?.items?.length ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white/85 backdrop-blur shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-600">Shopping list</p>
                  <p className="text-sm text-slate-500">
                    {result.plan.shopping_list.total_unique} unique ingredients
                  </p>
                </div>

                <button
                  onClick={() => {
                    const text = result.plan.shopping_list?.items
                      ?.map((x) => `${x.ingredient} (x${x.count})`)
                      .join("\n");
                    navigator.clipboard.writeText(text || "");
                  }}
                  className="rounded-2xl px-4 py-2 border border-slate-200 bg-white font-bold hover:border-rose-200 transition"
                >
                  Copy list
                </button>
              </div>

              <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {result.plan.shopping_list.items.slice(0, 24).map((it) => (
                  <div
                    key={it.ingredient}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{it.ingredient}</span>
                    <span className="text-slate-500"> ×{it.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-600">{title}</p>
      <p className="text-lg font-extrabold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
      <p className="text-lg font-extrabold">No plan yet</p>
      <p className="text-sm text-slate-600 mt-2">Generate a plan first.</p>
    </div>
  );
}

function MealCard({
  meal,
  index,
  onReplace,
}: {
  meal: Meal;
  index: number;
  onReplace: (slot: string, target: number, currentRecipeId: number) => void;
}) {
  const title =
    meal.slot && meal.slot !== meal.meal_type
      ? `${meal.meal_type} (${meal.slot})`
      : meal.meal_type;

  const preference = meal.predicted_preference;
  const score =
    typeof meal.preference_score === "number" ? meal.preference_score : null;

  const preferenceBadgeClass =
    preference === "High"
      ? "bg-green-100 text-green-700 border-green-200"
      : preference === "Medium"
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : preference === "Low"
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">
            Meal {index} • {title}
          </p>

          <p className="text-sm font-extrabold text-slate-900 truncate">
            {meal.name}
          </p>

          <p className="text-xs text-slate-500 mt-1">⏱ Prep time: {meal.minutes} min</p>

          {meal.main_protein && (
            <p className="text-xs text-slate-500 mt-1 capitalize">
              Main protein: {meal.main_protein}
            </p>
          )}

          {meal.selection_note && (
            <p className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 inline-block">
              {meal.selection_note}
            </p>
          )}

          {preference && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${preferenceBadgeClass}`}
              >
                {preference} Preference
              </span>

              {score !== null && score >= 0.85 && (
                <span className="rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                  🔥 Top Recommendation
                </span>
              )}
            </div>
          )}

          {score !== null && (
            <p className="mt-2 text-xs text-slate-500">
              Match Score: {(score * 100).toFixed(0)}%
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Tag label={`P ${meal.protein_g}g`} />
            <Tag label={`C ${meal.carbs_g}g`} />
            <Tag label={`F ${meal.fat_g}g`} />
            <Tag label={`Fiber ${meal.fiber_g}g`} />
            <Tag label={`Sugar ${meal.sugar_g}g`} />
          </div>

          <p className="text-xs text-slate-600 mt-2 line-clamp-2">
            {(meal.ingredients ?? []).slice(0, 6).join(", ")}
            {(meal.ingredients ?? []).length > 6 ? "..." : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-extrabold text-slate-900">{meal.calories} kcal</p>
          <p className="text-xs text-slate-500 mt-1">
            Target {meal.target_calories} kcal
          </p>

          <button
            onClick={() =>
              onReplace(
                meal.slot ?? meal.meal_type,
                Number(meal.target_calories),
                Number(meal.recipe_id)
              )
            }
            className="mt-3 rounded-2xl px-4 py-2 border border-slate-200 bg-white font-bold hover:border-rose-200 transition text-sm"
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-bold text-slate-700">
      {label}
    </span>
  );
}