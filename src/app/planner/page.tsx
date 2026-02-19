"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 15000;

type PlanAPIResponse =
  | { status: "ok"; plan: any }
  | { status: "error"; message?: string }
  | any;

export default function PlannerPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    calories: 1800,
    meals_per_day: 3,
    days: 3,
    diet_type: "non-vegetarian" as "vegetarian" | "non-vegetarian",
    goal: "maintain" as "lose_weight" | "maintain" | "gain_muscle",
    allergies: "",
    exclude_ultra_processed: true,
    variety: true,
  });

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanAPIResponse | null>(null);
  const [activeDay, setActiveDay] = useState<number>(1);

  const abortRef = useRef<AbortController | null>(null);

  // ✅ NEW: work with new backend shape: result.plan.days[]
  const days = result?.plan?.days ?? [];
  const activeDayObj = useMemo(
    () => (Array.isArray(days) ? days.find((d: any) => d.day === activeDay) ?? days[0] : null),
    [days, activeDay]
  );

  // progress animation
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

  // cleanup: abort if user leaves page
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleGenerate = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const payload = {
        calories: Number(form.calories),
        meals_per_day: Number(form.meals_per_day),
        days: Number(form.days),
        diet_type: form.diet_type,
        goal: form.goal,
        allergies: form.allergies
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        exclude_ultra_processed: form.exclude_ultra_processed,
        variety: form.variety,
      };

      const res = await fetch(`${API_BASE}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = (await res.json()) as any;

      if (!res.ok) throw new Error(data?.detail ?? data?.message ?? "Backend error");
      if (data?.status !== "ok") throw new Error(data?.message ?? "Unable to generate plan");

      setResult(data);
      setActiveDay(1);

      setProgress(100);
      setTimeout(() => setProgress(0), 400);
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "Request timed out. Try again (or your backend is slow / stuck)."
          : e?.message ?? "Unknown error";
      setResult(null);
      setError(msg);
      setProgress(0);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  // ✅ Replace meal handler used by MealCard
  const handleReplace = async (slot: string, target: number, excludeIds: number[]) => {
    if (!result?.plan) return;

    setError(null);

    try {
      const payload = {
        calories: Number(form.calories),
        meals_per_day: Number(form.meals_per_day),
        diet_type: form.diet_type,
        goal: form.goal,
        allergies: form.allergies
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        exclude_ultra_processed: form.exclude_ultra_processed,
        variety: form.variety,
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
      if (!res.ok || data?.status !== "ok") throw new Error(data?.detail ?? "Replace failed");

      const newMeal = data.meal;

      // Update state: replace meal inside active day
      const newDays = (result.plan.days ?? []).map((d: any) => {
        if (d.day !== activeDay) return d;

        const updatedMeals = (d.meals ?? []).map((mm: any) =>
          (mm.slot ?? mm.meal_type) === slot ? newMeal : mm
        );

        // recompute day totals
        const t = updatedMeals.reduce(
          (acc: any, mm: any) => {
            acc.calories += Number(mm.calories || 0);
            acc.protein_g += Number(mm.protein_g || 0);
            acc.carbs_g += Number(mm.carbs_g || 0);
            acc.fat_g += Number(mm.fat_g || 0);
            return acc;
          },
          { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
        );

        return {
          ...d,
          meals: updatedMeals,
          totals: {
            calories: Number(t.calories.toFixed(1)),
            protein_g: Number(t.protein_g.toFixed(1)),
            carbs_g: Number(t.carbs_g.toFixed(1)),
            fat_g: Number(t.fat_g.toFixed(1)),
          },
        };
      });

      // recompute overall totals
      const overall = newDays.reduce(
        (acc: any, d: any) => {
          acc.calories += Number(d.totals?.calories || 0);
          acc.protein_g += Number(d.totals?.protein_g || 0);
          acc.carbs_g += Number(d.totals?.carbs_g || 0);
          acc.fat_g += Number(d.totals?.fat_g || 0);
          return acc;
        },
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      );

      // recompute shopping list locally
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

      const next = {
        ...result,
        plan: {
          ...result.plan,
          days: newDays,
          overall_totals: {
            calories: Number(overall.calories.toFixed(1)),
            protein_g: Number(overall.protein_g.toFixed(1)),
            carbs_g: Number(overall.carbs_g.toFixed(1)),
            fat_g: Number(overall.fat_g.toFixed(1)),
          },
          shopping_list: { total_unique: shoppingItems.length, items: shoppingItems },
        },
      };

      setResult(next);
    } catch (e: any) {
      setError(e?.message ?? "Replace failed");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-rose-200/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <button
            onClick={() => router.push("/")}
            className="rounded-2xl px-4 py-2 border border-slate-200 bg-white font-semibold hover:border-rose-200 transition"
          >
            ← Back
          </button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 py-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <p className="text-sm font-semibold text-rose-700">Smart Meal Planner</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start overflow-hidden">
          {/* LEFT */}
          <section className="rounded-3xl border border-slate-200 bg-white/85 backdrop-blur p-6 shadow-sm space-y-5">
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold">Generate your plan</h1>
              <p className="text-sm text-slate-600">
                Set your goal, calories, diet, and constraints — we’ll build a structured plan you can follow.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories per day">
                <input
                  type="number"
                  value={form.calories}
                  onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </Field>

              <Field label="Meals per day (1–6)">
                <input
                  type="number"
                  value={form.meals_per_day}
                  onChange={(e) => setForm({ ...form, meals_per_day: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </Field>

              <Field label="Days (1–14)">
                <input
                  type="number"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </Field>

              <Field label="Diet type">
                <select
                  value={form.diet_type}
                  onChange={(e) => setForm({ ...form, diet_type: e.target.value as any })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
                >
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non-vegetarian">Non-vegetarian</option>
                </select>
              </Field>

              <Field label="Goal">
                <select
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value as any })}
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
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.exclude_ultra_processed}
                  onChange={(e) => setForm({ ...form, exclude_ultra_processed: e.target.checked })}
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

            {/* Progress bar */}
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
                <p className="text-[11px] text-slate-500">
                  Filtering constraints → ranking recipes → composing meals → calculating macros
                </p>
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

          {/* RIGHT */}
          <section className="min-w-0 overflow-hidden">
            <div className="rounded-3xl border border-slate-200 bg-white/85 backdrop-blur shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Today snapshot</p>
                  <h2 className="text-2xl font-extrabold">
                    {activeDayObj ? `Day ${activeDayObj.day} • ${activeDayObj.totals?.calories ?? 0} kcal` : "No plan yet"}
                  </h2>
                </div>

                {days.length > 0 && (
                  <div className="flex items-center gap-2">
                    {days.map((d: any) => (
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
                    {(activeDayObj.meals ?? []).map((m: any, idx: number) => (
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
                        Rule-Based Filtering + Goal-Aware Ranking + Variety Penalty + Per-meal Health Rules
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Plan totals */}
            {result?.plan?.overall_totals && (
              <div className="grid sm:grid-cols-4 gap-3 mt-4">
                <Stat title="Plan calories" value={`${result.plan.overall_totals.calories} kcal`} />
                <Stat title="Protein" value={`${result.plan.overall_totals.protein_g} g`} />
                <Stat title="Carbs" value={`${result.plan.overall_totals.carbs_g} g`} />
                <Stat title="Fat" value={`${result.plan.overall_totals.fat_g} g`} />
              </div>
            )}

            {/* Shopping list */}
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
                      const text = result.plan.shopping_list.items
                        .map((x: any) => `${x.ingredient} (x${x.count})`)
                        .join("\n");
                      navigator.clipboard.writeText(text);
                    }}
                    className="rounded-2xl px-4 py-2 border border-slate-200 bg-white font-bold hover:border-rose-200 transition"
                  >
                    Copy list
                  </button>
                </div>

                <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {result.plan.shopping_list.items.slice(0, 24).map((it: any) => (
                    <div key={it.ingredient} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="font-semibold">{it.ingredient}</span>
                      <span className="text-slate-500"> ×{it.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

/* ---------------- UI components ---------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-slate-600">{label}</p>
      {children}
    </div>
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
      <p className="text-sm text-slate-600 mt-2">
        Fill the form and click <span className="font-semibold">Generate Plan</span>.
      </p>
    </div>
  );
}

function MealCard({
  meal,
  index,
  onReplace,
}: {
  meal: any;
  index: number;
  onReplace: (slot: string, target: number, excludeIds: number[]) => void;
}) {
  const title = meal.slot && meal.slot !== meal.meal_type ? `${meal.meal_type} (${meal.slot})` : meal.meal_type;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">
            Meal {index} • {title}
          </p>
          <p className="text-sm font-extrabold text-slate-900 truncate">{meal.name}</p>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Tag label={`P ${meal.protein_g}g`} />
            <Tag label={`C ${meal.carbs_g}g`} />
            <Tag label={`F ${meal.fat_g}g`} />
          </div>

          <p className="text-xs text-slate-600 mt-2 line-clamp-2">
            {(meal.ingredients ?? []).slice(0, 6).join(", ")}
            {(meal.ingredients ?? []).length > 6 ? "..." : ""}
          </p>

          {meal.explain && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-bold">Why this recipe?</p>
              <ul className="mt-1 space-y-1">
                <li>• Calorie delta: {meal.explain.calorie_delta} kcal vs target</li>
                <li>• Protein: {meal.explain.protein_g}g (goal-weighted)</li>
                <li>
                  • Sugar: {meal.explain.sugar_g}g • Sodium: {meal.explain.sodium_mg}mg • Sat fat:{" "}
                  {meal.explain.sat_fat_g}g
                </li>
                <li>• Variety penalty: {meal.explain.variety_penalty}</li>
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-extrabold text-slate-900">{meal.calories} kcal</p>
          <p className="text-xs text-slate-500 mt-1">Target {meal.target_calories} kcal</p>

          <button
            onClick={() => onReplace(meal.slot ?? meal.meal_type, Number(meal.target_calories), [Number(meal.recipe_id)])}
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
