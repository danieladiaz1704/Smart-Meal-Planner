"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

/* match FastAPI response*/

type Ingredient = {
  FoodID: number;
  FoodDescription: string;
  FoodGroupName: string;
};

type MacroTotals = {
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

type MealFromAPI = {
  meal_number: number;
  recipe_name: string;
  target_calories: number;
  ingredients: Ingredient[];
  totals: MacroTotals;
};

type DayFromAPI = {
  day: number;
  meals: MealFromAPI[];
  day_totals: MacroTotals;
};

type MealPlanRequest = {
  calories: number;
  meals_per_day: number;
  days: number;
  diet_type: "vegetarian" | "non-vegetarian";
  goal: "lose_weight" | "maintain" | "gain_muscle";
  allergies: string[];
  exclude_ultra_processed: boolean;
  variety?: boolean;
};

type MealPlanResponseOK = {
  status: "ok";
  request: MealPlanRequest;
  plan: DayFromAPI[];
  plan_totals: MacroTotals;
  explainability?: unknown;
};

type MealPlanResponseERR = {
  status: "error";
  message?: string;
};

type MealPlanResponse = MealPlanResponseOK | MealPlanResponseERR;

type ReplaceMealResponse = {
  status: "ok" | "error";
  replacement?: {
    recipe_name: string;
    ingredients: Ingredient[];
    totals: MacroTotals;
  };
  detail?: string;
  message?: string;
};

/* Page */

export default function MealPlanPage() {
  const router = useRouter();

  const [data, setData] = useState<MealPlanResponse | null>(null);
  const [activeDay, setActiveDay] = useState<number>(1);

  const [busyMeal, setBusyMeal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("meal_plan_result");
      if (!raw) return;
      const parsed = JSON.parse(raw) as MealPlanResponse;
      setData(parsed);

      if (parsed.status === "ok" && parsed.plan.length > 0) {
        setActiveDay(parsed.plan[0].day);
      }
    } catch {
      // ignore
    }
  }, []);

  const hasPlan = data?.status === "ok";

  const planType = useMemo(() => {
    if (!hasPlan) return "Daily";
    return data.request.days > 1 ? "Weekly" : "Daily";
  }, [hasPlan, data]);

  const active = useMemo(() => {
    if (!hasPlan) return null;
    return data.plan.find((d) => d.day === activeDay) ?? data.plan[0] ?? null;
  }, [hasPlan, data, activeDay]);

  const summary = useMemo(() => {
    if (!hasPlan) return null;
    const t = data.plan_totals;
    return [
      { label: "Calories", value: `${Math.round(t.calories_kcal)} kcal` },
      { label: "Protein", value: `${Math.round(t.protein_g)} g` },
      { label: "Carbs", value: `${Math.round(t.carbs_g)} g` },
      { label: "Fat", value: `${Math.round(t.fat_g)} g` },
    ];
  }, [hasPlan, data]);

  async function handleReplaceMeal(meal_number: number) {
    if (!hasPlan) return;

    setErr(null);
    setBusyMeal(meal_number);

    try {
      const day = active;
      const req = data.request;

      const target =
        day?.meals.find((m) => m.meal_number === meal_number)?.target_calories ??
        req.calories / req.meals_per_day;

      const payload = {
        calories: req.calories,
        meals_per_day: req.meals_per_day,
        diet_type: req.diet_type,
        goal: req.goal,
        allergies: req.allergies ?? [],
        exclude_ultra_processed: req.exclude_ultra_processed ?? false,
        target_meal_calories: target,
      };

      const res = await fetch(`${API_BASE}/replace-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = (await res.json().catch(() => ({}))) as ReplaceMealResponse;

      if (!res.ok) {
        
        const msg = (j as any)?.detail ?? j.message ?? `Replace failed (HTTP ${res.status})`;
        throw new Error(String(msg));
      }

      if (j.status !== "ok" || !j.replacement) {
        throw new Error(j.message ?? "No replacement returned");
      }

      const replacement = j.replacement;

      
      setData((prev) => {
        if (!prev || prev.status !== "ok") return prev;

        const newPlan = prev.plan.map((d) => {
          if (d.day !== activeDay) return d;

          const newMeals = d.meals.map((m) =>
            m.meal_number === meal_number
              ? {
                  ...m,
                  recipe_name: replacement.recipe_name,
                  ingredients: replacement.ingredients,
                  totals: replacement.totals,
                }
              : m
          );

          
          const dayTotals = newMeals.reduce<MacroTotals>(
            (acc, m) => ({
              calories_kcal: acc.calories_kcal + m.totals.calories_kcal,
              protein_g: acc.protein_g + m.totals.protein_g,
              fat_g: acc.fat_g + m.totals.fat_g,
              carbs_g: acc.carbs_g + m.totals.carbs_g,
            }),
            { calories_kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
          );

          return { ...d, meals: newMeals, day_totals: dayTotals };
        });

       
        const planTotals = newPlan.reduce<MacroTotals>(
          (acc, d) => ({
            calories_kcal: acc.calories_kcal + d.day_totals.calories_kcal,
            protein_g: acc.protein_g + d.day_totals.protein_g,
            fat_g: acc.fat_g + d.day_totals.fat_g,
            carbs_g: acc.carbs_g + d.day_totals.carbs_g,
          }),
          { calories_kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
        );

        const next: MealPlanResponseOK = { ...prev, plan: newPlan, plan_totals: planTotals };
        sessionStorage.setItem("meal_plan_result", JSON.stringify(next));
        return next;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Replace failed";
      setErr(msg);
    } finally {
      setBusyMeal(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50 p-6 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[32px] border bg-white/70 backdrop-blur p-6 sm:p-10 shadow-sm">
          <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-rose-300/45 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-orange-300/45 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-center">
            <div className="space-y-4 animate-fadeUp">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 py-2 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <p className="text-xs font-bold text-rose-700">
                  Smart Meal Planner • CNF-powered • Explainable AI
                </p>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                Your {planType} Meal Plan
              </h1>

              <p className="text-sm sm:text-base text-slate-600 max-w-xl">
                Meal planning is time consuming. We generate balanced plans from your goal,
                calories, diet, and allergies fast.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Chip label={`Diet: ${hasPlan ? data.request.diet_type : "-"}`} />
                <Chip label={`Goal: ${hasPlan ? data.request.goal : "-"}`} />
                <Chip label={`Meals/day: ${hasPlan ? data.request.meals_per_day : "-"}`} />
                <Chip
                  label={`Allergies: ${
                    hasPlan && data.request.allergies.length
                      ? data.request.allergies.join(", ")
                      : "None"
                  }`}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-3">
                <button
                  onClick={() => router.push("/planner")}
                  className="rounded-2xl px-5 py-3 border border-slate-200 bg-white font-bold hover:border-rose-300 transition"
                >
                  ← Planner
                </button>

                <button
                  onClick={() => {
                    sessionStorage.removeItem("meal_plan_result");
                    router.push("/planner");
                  }}
                  className="rounded-2xl px-5 py-3 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-extrabold hover:opacity-95 transition"
                >
                  New Plan
                </button>
              </div>

              {err && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {err}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="relative animate-fadeUp">
              <div className="absolute -top-10 -right-6 rotate-6 opacity-90 animate-floaty">
                <PlateSvg />
              </div>

              <div className="rounded-3xl border border-rose-100 bg-white/85 backdrop-blur p-5 shadow-[0_10px_30px_rgba(244,63,94,0.10)]">
                <p className="text-xs font-bold text-slate-500">Today snapshot</p>
                <p className="text-lg font-extrabold mt-1">
                  Day {active?.day ?? 1} •{" "}
                  {Math.round(active?.day_totals.calories_kcal ?? 0)} kcal
                </p>

                <div className="mt-4 grid gap-3">
                  {(active?.meals ?? []).slice(0, 3).map((m) => (
                    <div
                      key={m.meal_number}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MealThumb idx={m.meal_number} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{m.recipe_name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {m.ingredients.map((i) => i.FoodDescription).join(", ")}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-slate-600 shrink-0">
                        {Math.round(m.totals.calories_kcal)} kcal
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <MiniStat label="Protein" value={`${Math.round(active?.day_totals.protein_g ?? 0)}g`} />
                  <MiniStat label="Carbs" value={`${Math.round(active?.day_totals.carbs_g ?? 0)}g`} />
                  <MiniStat label="Fat" value={`${Math.round(active?.day_totals.fat_g ?? 0)}g`} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {!hasPlan && (
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="font-bold text-lg">No plan found</h2>
            <p className="text-slate-600 mt-2 text-sm">
              Generate a plan first in <span className="font-semibold">/planner</span>.
            </p>
          </section>
        )}

        {hasPlan && summary && (
          <section className="grid gap-3 sm:grid-cols-4">
            {summary.map((s) => (
              <div key={s.label} className="rounded-3xl border bg-white/80 backdrop-blur p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                <p className="text-lg font-extrabold mt-1">{s.value}</p>
              </div>
            ))}
          </section>
        )}

        {hasPlan && active && (
          <>
            <section className="rounded-3xl border bg-white/80 backdrop-blur p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {data.plan.map((d) => (
                  <button
                    key={d.day}
                    onClick={() => setActiveDay(d.day)}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold border transition",
                      activeDay === d.day
                        ? "bg-gradient-to-r from-rose-600 to-orange-500 text-white border-transparent"
                        : "bg-white border-slate-200 hover:border-rose-300",
                    ].join(" ")}
                  >
                    Day {d.day}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <h2 className="text-xl font-extrabold">Day {active.day}</h2>
                <p className="text-sm text-slate-600">
                  Total:{" "}
                  <span className="font-semibold">
                    {Math.round(active.day_totals.calories_kcal)} kcal
                  </span>{" "}
                  · P {Math.round(active.day_totals.protein_g)}g · C{" "}
                  {Math.round(active.day_totals.carbs_g)}g · F{" "}
                  {Math.round(active.day_totals.fat_g)}g
                </p>
              </div>
            </section>

            <section className="grid gap-4">
              {active.meals.map((m) => (
                <div key={m.meal_number} className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-4">
                      <MealThumbBig idx={m.meal_number} />
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Meal {m.meal_number}
                        </p>
                        <p className="text-xl font-extrabold">{m.recipe_name}</p>
                        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                          {m.ingredients.map((i) => i.FoodDescription).join(", ")}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-semibold">Calories</p>
                      <p className="text-lg font-extrabold">
                        {Math.round(m.totals.calories_kcal)} kcal
                      </p>
                      <p className="text-xs text-slate-500">
                        Target: {Math.round(m.target_calories)} kcal
                      </p>

                      <button
                        onClick={() => handleReplaceMeal(m.meal_number)}
                        disabled={busyMeal === m.meal_number}
                        className="mt-3 rounded-2xl px-4 py-2 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-extrabold hover:opacity-95 disabled:opacity-60"
                      >
                        {busyMeal === m.meal_number ? "Replacing..." : "Replace meal"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge label={`Protein ${Math.round(m.totals.protein_g)}g`} />
                    <Badge label={`Carbs ${Math.round(m.totals.carbs_g)}g`} />
                    <Badge label={`Fat ${Math.round(m.totals.fat_g)}g`} />
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/* ---------- small components ---------- */

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-bold text-rose-700 shadow-sm">
      {label}
    </span>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className="text-sm font-extrabold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function MealThumb({ idx }: { idx: number }) {
  const styles = [
    "from-rose-500 to-orange-400",
    "from-orange-500 to-amber-400",
    "from-fuchsia-500 to-rose-400",
    "from-emerald-500 to-cyan-400",
    "from-indigo-500 to-sky-400",
    "from-teal-500 to-lime-400",
  ];
  const s = styles[idx % styles.length];
  return <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${s} shadow-sm`} />;
}

function MealThumbBig({ idx }: { idx: number }) {
  const styles = [
    "from-rose-500 to-orange-400",
    "from-orange-500 to-amber-400",
    "from-fuchsia-500 to-rose-400",
    "from-emerald-500 to-cyan-400",
    "from-indigo-500 to-sky-400",
    "from-teal-500 to-lime-400",
  ];
  const s = styles[idx % styles.length];
  return (
    <div className={`h-14 w-14 rounded-3xl bg-gradient-to-br ${s} shadow-[0_10px_30px_rgba(244,63,94,0.15)]`} />
  );
}

function PlateSvg() {
  return (
    <svg width="160" height="160" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <circle cx="100" cy="100" r="76" fill="url(#g1)" opacity="0.85" />
      <circle cx="100" cy="100" r="56" fill="white" opacity="0.9" />
      <circle cx="100" cy="100" r="40" fill="url(#g2)" opacity="0.8" />
      <path
        d="M72 95c10-8 18-8 28 0s18 8 28 0"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <defs>
        <radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(70 60) rotate(45) scale(120)">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#fb923c" />
        </radialGradient>
        <radialGradient id="g2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(120 120) rotate(45) scale(90)">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#fb7185" />
        </radialGradient>
      </defs>
    </svg>
  );
}
