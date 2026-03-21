"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://smart-meal-planner-1-2c4l.onrender.com";
const REQUEST_TIMEOUT_MS = 15000;

const PROTEIN_OPTIONS = [
  "Chicken breast",
  "Turkey breast",
  "Lean ground turkey",
  "Salmon",
  "Shrimp",
  "Canned tuna",
  "Egg",
  "Greek yogurt 0%",
  "Skyr 0%",
  "Cottage cheese 1%",
  "Paneer",
  "Tofu",
  "Tempeh",
  "Lentils",
  "Chickpeas",
  "Black beans",
  "Whey protein powder",
] as const;

const MEAL_TYPE_OPTIONS = ["breakfast", "lunch", "dinner", "snack"] as const;

type DietType = "vegan" | "vegetarian" | "non-vegetarian";
type GoalType = "lose_weight" | "maintain" | "gain_muscle";
type PrepTimePreference = "any" | "quick" | "moderate";
type MacroPreference = "balanced" | "high_protein" | "high_carb" | "lower_carb";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

function toCsvList(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function PlannerPage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const [form, setForm] = useState({
    calories: 1800,
    meals_per_day: 3,
    days: 3,
    diet_type: "non-vegetarian" as DietType,
    goal: "maintain" as GoalType,
    allergies: "",
    exclude_ultra_processed: true,
    variety: true,
    prep_time_preference: "any" as PrepTimePreference,
    macro_preference: "balanced" as MacroPreference,
    favorite_proteins: [] as string[],
    likes: "",
    dislikes: "",
    favorite_meal_types: [] as MealType[],
    preferred_prep_time: "",
  });

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;

    setProgress(0);
    let p = 0;

    const t = setInterval(() => {
      const step = p < 60 ? 6 : p < 85 ? 3 : 1;
      p = Math.min(92, p + step);
      setProgress(p);
    }, 220);

    return () => clearInterval(t);
  }, [loading]);

  const toggleFavoriteProtein = (protein: string) => {
    setForm((prev) => {
      const exists = prev.favorite_proteins.includes(protein);
      return {
        ...prev,
        favorite_proteins: exists
          ? prev.favorite_proteins.filter((p) => p !== protein)
          : [...prev.favorite_proteins, protein],
      };
    });
  };

  const toggleFavoriteMealType = (mealType: MealType) => {
    setForm((prev) => {
      const exists = prev.favorite_meal_types.includes(mealType);
      return {
        ...prev,
        favorite_meal_types: exists
          ? prev.favorite_meal_types.filter((m) => m !== mealType)
          : [...prev.favorite_meal_types, mealType],
      };
    });
  };

  const buildPayload = () => ({
    calories: Number(form.calories),
    meals_per_day: Number(form.meals_per_day),
    days: Number(form.days),
    diet_type: form.diet_type,
    goal: form.goal,
    allergies: toCsvList(form.allergies),
    exclude_ultra_processed: form.exclude_ultra_processed,
    variety: form.variety,
    prep_time_preference: form.prep_time_preference,
    macro_preference: form.macro_preference,
    favorite_proteins: form.favorite_proteins,
    likes: toCsvList(form.likes),
    dislikes: toCsvList(form.dislikes),
    favorite_meal_types: form.favorite_meal_types,
    preferred_prep_time: form.preferred_prep_time
      ? Number(form.preferred_prep_time)
      : null,
  });

  const handleGenerate = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const payload = buildPayload();

      const res = await fetch(`${API_BASE}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok || data?.status !== "ok") {
        throw new Error(data?.detail ?? data?.message ?? "Unable to generate plan");
      }

      sessionStorage.setItem("mealPlanRequest", JSON.stringify(payload));
      sessionStorage.setItem("mealPlanResult", JSON.stringify(data));

      setProgress(100);

      setTimeout(() => {
        router.push("/meal-plan");
      }, 250);
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "Request timed out. Try again."
          : e?.message ?? "Unknown error";

      setError(msg);
      setProgress(0);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-rose-200/40 to-transparent" />

      <div className="relative mx-auto max-w-4xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-semibold hover:border-rose-200 transition"
          >
            ← Back
          </button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <p className="text-sm font-semibold text-rose-700">Smart Meal Planner</p>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white/85 backdrop-blur p-6 shadow-sm space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold">Generate your plan</h1>
            <p className="text-sm text-slate-600">
              Answer the questions and we’ll generate your personalized meal plan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories per day">
              <input
                type="number"
                value={form.calories}
                onChange={(e) =>
                  setForm({ ...form, calories: Number(e.target.value) })
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Meals per day (1–6)">
              <input
                type="number"
                value={form.meals_per_day}
                onChange={(e) =>
                  setForm({ ...form, meals_per_day: Number(e.target.value) })
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Days (1–14)">
              <input
                type="number"
                value={form.days}
                onChange={(e) =>
                  setForm({ ...form, days: Number(e.target.value) })
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Diet type">
              <select
                value={form.diet_type}
                onChange={(e) =>
                  setForm({ ...form, diet_type: e.target.value as DietType })
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
              >
                <option value="vegan">Vegan</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="non-vegetarian">Non-vegetarian</option>
              </select>
            </Field>

            <Field label="Goal">
              <select
                value={form.goal}
                onChange={(e) =>
                  setForm({ ...form, goal: e.target.value as GoalType })
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
              >
                <option value="lose_weight">Lose weight</option>
                <option value="maintain">Maintain</option>
                <option value="gain_muscle">Gain muscle</option>
              </select>
            </Field>

            <Field label="Allergies (comma separated)">
              <input
                type="text"
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                placeholder="nuts, dairy"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Prep time preference">
              <select
                value={form.prep_time_preference}
                onChange={(e) =>
                  setForm({
                    ...form,
                    prep_time_preference: e.target.value as PrepTimePreference,
                  })
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
              >
                <option value="any">Any</option>
                <option value="quick">Quick meals</option>
                <option value="moderate">Moderate</option>
              </select>
            </Field>

            <Field label="Macro preference">
              <select
                value={form.macro_preference}
                onChange={(e) =>
                  setForm({
                    ...form,
                    macro_preference: e.target.value as MacroPreference,
                  })
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
              >
                <option value="balanced">Balanced</option>
                <option value="high_protein">High protein</option>
                <option value="high_carb">High carb</option>
                <option value="lower_carb">Lower carb</option>
              </select>
            </Field>
          </div>

          <Field label="Likes (comma separated)">
            <input
              type="text"
              value={form.likes}
              onChange={(e) => setForm({ ...form, likes: e.target.value })}
              placeholder="salmon, avocado, rice"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Dislikes (comma separated)">
            <input
              type="text"
              value={form.dislikes}
              onChange={(e) => setForm({ ...form, dislikes: e.target.value })}
              placeholder="tofu, mushrooms"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Preferred prep time (minutes)">
            <input
              type="number"
              min={1}
              max={180}
              value={form.preferred_prep_time}
              onChange={(e) =>
                setForm({ ...form, preferred_prep_time: e.target.value })
              }
              placeholder="15"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-600">Favorite meal types</p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              {MEAL_TYPE_OPTIONS.map((mealType) => (
                <label
                  key={mealType}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={form.favorite_meal_types.includes(mealType)}
                    onChange={() => toggleFavoriteMealType(mealType)}
                  />
                  <span className="capitalize">{mealType}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-600">Favorite proteins</p>
            <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-2">
                {PROTEIN_OPTIONS.map((protein) => (
                  <label
                    key={protein}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.favorite_proteins.includes(protein)}
                      onChange={() => toggleFavoriteProtein(protein)}
                    />
                    <span>{protein}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.exclude_ultra_processed}
                onChange={(e) =>
                  setForm({
                    ...form,
                    exclude_ultra_processed: e.target.checked,
                  })
                }
              />
              Exclude ultra-processed
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.variety}
                onChange={(e) => setForm({ ...form, variety: e.target.checked })}
              />
              Variety mode
            </label>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Generating with AI…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-600 to-orange-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full rounded-2xl px-6 py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-extrabold hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Plan"}
          </button>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-2xl">
              {error}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-slate-600">{label}</p>
      {children}
    </div>
  );
}