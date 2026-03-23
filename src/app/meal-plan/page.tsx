"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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

    if (!currentUser?.email || !result?.plan || !requestData) {
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

    alert("Plan saved successfully!");

    const feedbackRequests: Promise<Response>[] = [];

    for (const day of result.plan.days || []) {
      for (const meal of day.meals || []) {
        feedbackRequests.push(
          fetch(`${API_BASE}/feedback`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_email: currentUser.email,
              meal_id: meal.recipe_id,
              meal_name: meal.name,
              meal_type: meal.meal_type,
              diet_type: requestData.diet_type,
              prep_time: meal.minutes,
              calories: meal.calories,
              protein: meal.protein_g,
              carbs: meal.carbs_g,
              fat: meal.fat_g,
              main_protein: meal.main_protein || "other",
              goal: requestData.goal,
              prep_preference: requestData.prep_time_preference,
              action: "saved",
            }),
          })
        );
      }
    }

    Promise.allSettled(feedbackRequests).then((results) => {
      console.log("Feedback results:", results);
    });

  } catch (err: any) {
    console.error("Save plan error:", err);
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
      <main className={`${manrope.className} min-h-screen bg-[#F8F6F2] text-[#16203A]`}>
        <div className="mx-auto max-w-4xl px-5 py-12">
          <div className="overflow-hidden rounded-[32px] border border-[#E8E1D8] bg-white shadow-[0_22px_70px_rgba(22,32,58,0.08)]">
            <div className="grid gap-6 p-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E45C43]">
                  Meal planner
                </p>
                <p className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">
                  No plan found
                </p>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Generate your meal plan first so we can show your daily meals,
                  nutrition totals, and shopping list here.
                </p>
                <button
                  onClick={() => router.push("/planner")}
                  className="mt-6 rounded-2xl bg-[#E45C43] px-5 py-3 font-bold text-white shadow-[0_16px_34px_rgba(228,92,67,0.22)] transition hover:opacity-95"
                >
                  Go to Planner
                </button>
              </div>

              <div className="overflow-hidden rounded-[28px] ring-1 ring-black/5">
                <img
                  src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80"
                  alt="Colorful healthy bowl"
                  className="h-[280px] w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${manrope.className} min-h-screen bg-[#F8F6F2] text-[#16203A]`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(circle_at_top_left,_rgba(228,92,67,0.14),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(22,32,58,0.08),_transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-5 py-8 md:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push("/planner")}
            className="rounded-full border border-[#E8E1D8] bg-white px-5 py-3 font-bold text-[#16203A] shadow-sm transition hover:bg-[#FAF8F5]"
          >
            ← Edit questions
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-[#F2D1C9] bg-white px-4 py-2 shadow-sm sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E45C43]" />
            <p className="text-sm font-bold text-[#A54334]">Meal Plan Results</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-[#F0C7CF] bg-[#FFF7FA] p-4 text-sm font-semibold text-[#A33A5B]">
            {error}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          {/* LEFT MAIN */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[34px] border border-[#E8E1D8] bg-white shadow-[0_26px_80px_rgba(22,32,58,0.08)]">
              <div className="grid gap-5 border-b border-[#F0EBE4] bg-[linear-gradient(180deg,#FFF8F4_0%,#FFFFFF_100%)] p-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E45C43]">
                    Today snapshot
                  </p>
                  <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                    {activeDayObj
                      ? `Day ${activeDayObj.day} • ${activeDayObj.totals?.calories ?? 0} kcal`
                      : "No plan yet"}
                  </h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-7 text-slate-600">
                    Your daily plan is structured for balance, variety, and easy swaps.
                    Review each meal, replace what you do not like, and save the plan when it feels right.
                  </p>

                  <button
                    onClick={handleSavePlan}
                    className="mt-5 rounded-2xl bg-[#E45C43] px-5 py-3 font-bold text-white shadow-[0_18px_36px_rgba(228,92,67,0.22)] transition hover:opacity-95"
                  >
                    Save Plan
                  </button>
                </div>

                <div className="relative overflow-hidden rounded-[28px] bg-[#16203A] shadow-[0_18px_50px_rgba(22,32,58,0.22)]">
                  <img
                    src={getDayImage(activeDayObj?.day ?? 1)}
                    alt="Meal planning visual"
                    className="h-[220px] w-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#16203A]/70 via-[#16203A]/20 to-transparent" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
                    Curated day
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white/75">Meals today</p>
                      <p className="text-3xl font-extrabold text-white">
                        {activeDayObj?.meals?.length ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/12 px-4 py-3 text-right backdrop-blur">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                        Goal
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-white">
                        {result?.plan?.meta?.goal
                          ? String(result.plan.meta.goal).replaceAll("_", " ")
                          : "Balanced"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-[#F0EBE4] px-6 py-5">
                {days.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {days.map((d) => (
                      <button
                        key={d.day}
                        onClick={() => setActiveDay(d.day)}
                        className={[
                          "rounded-full px-4 py-2 text-sm font-bold border transition",
                          activeDay === d.day
                            ? "bg-[#E45C43] text-white border-[#E45C43] shadow-[0_10px_24px_rgba(228,92,67,0.18)]"
                            : "bg-white text-slate-700 border-[#E8E1D8] hover:bg-[#FFF7F3]",
                        ].join(" ")}
                      >
                        Day {d.day}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 space-y-5">
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

                    <div className="grid gap-4 pt-2 sm:grid-cols-3">
                      <Stat title="Protein" value={`${activeDayObj.totals?.protein_g ?? 0} g`} />
                      <Stat title="Carbs" value={`${activeDayObj.totals?.carbs_g ?? 0} g`} />
                      <Stat title="Fat" value={`${activeDayObj.totals?.fat_g ?? 0} g`} />
                    </div>

                    <div className="rounded-[28px] border border-[#E8E1D8] bg-[#FBFAF8] p-5">
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E45C43]">
                        Explainability
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Rule-Based Filtering + Goal-Aware Ranking + Machine Learning
                        Preference Score + User Macro / Prep Preferences
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {result?.plan?.overall_totals && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat title="Plan calories" value={`${result.plan.overall_totals.calories} kcal`} />
                <Stat title="Protein" value={`${result.plan.overall_totals.protein_g} g`} />
                <Stat title="Carbs" value={`${result.plan.overall_totals.carbs_g} g`} />
                <Stat title="Fat" value={`${result.plan.overall_totals.fat_g} g`} />
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[32px] border border-[#E8E1D8] bg-white shadow-[0_22px_70px_rgba(22,32,58,0.08)]">
              <div className="relative h-[220px] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80"
                  alt="Fresh ingredients and meal prep"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#16203A]/72 via-[#16203A]/20 to-transparent" />
                <div className="absolute left-5 bottom-5 right-5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/80">
                    Weekly overview
                  </p>
                  <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-white">
                    Ingredients that keep your week simple
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SidebarMiniStat
                    label="Days planned"
                    value={String(result?.plan?.meta?.days ?? days.length ?? 0)}
                  />
                  <SidebarMiniStat
                    label="Meals/day"
                    value={String(result?.plan?.meta?.meals_per_day ?? 0)}
                  />
                  <SidebarMiniStat
                    label="Diet"
                    value={formatMeta(result?.plan?.meta?.diet_type)}
                  />
                  <SidebarMiniStat
                    label="Prep style"
                    value={formatMeta(result?.plan?.meta?.prep_time_preference)}
                  />
                </div>
              </div>
            </div>

            {result?.plan?.shopping_list?.items?.length ? (
              <div className="overflow-hidden rounded-[32px] border border-[#E8E1D8] bg-white shadow-[0_22px_70px_rgba(22,32,58,0.08)]">
                <div className="border-b border-[#F0EBE4] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E45C43]">
                        Shopping list
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
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
                      className="rounded-2xl border border-[#E8E1D8] bg-white px-4 py-2 font-bold text-[#16203A] transition hover:bg-[#FFF7F3]"
                    >
                      Copy list
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {result.plan.shopping_list.items.map((it) => (
                      <div
                        key={it.ingredient}
                        className="rounded-full border border-[#F1D8D0] bg-[#FFF7F3] px-4 py-2 text-sm font-bold text-[#A44C3C]"
                      >
                        {it.ingredient} ×{it.count}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function getDayImage(day: number) {
  const images = [
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1400&q=80",
  ];
  return images[(Math.max(day, 1) - 1) % images.length];
}

function formatMeta(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replaceAll("_", " ");
}

function SidebarMiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#E8E1D8] bg-[#FBFAF8] p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#E45C43]">
        {label}
      </p>
      <p className="mt-2 text-lg font-extrabold tracking-[-0.02em] text-[#16203A] capitalize">
        {value}
      </p>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[26px] border border-[#E8E1D8] bg-white p-5 shadow-[0_10px_26px_rgba(22,32,58,0.05)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#E45C43]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#16203A]">
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[30px] border border-[#E8E1D8] bg-white p-10 text-center">
      <p className="text-xl font-extrabold tracking-[-0.03em] text-[#16203A]">
        No plan yet
      </p>
      <p className="mt-2 text-sm text-slate-600">Generate a plan first.</p>
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
      ? "bg-[#EAF8EC] text-[#2E7D4F] border-[#CFECD5]"
      : preference === "Medium"
      ? "bg-[#FFF4DD] text-[#A87016] border-[#F4DBA9]"
      : preference === "Low"
      ? "bg-[#FFF0F0] text-[#C74747] border-[#F2CCCC]"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="overflow-hidden rounded-[30px] border border-[#E8E1D8] bg-white shadow-[0_12px_34px_rgba(22,32,58,0.05)]">
      <div className="grid gap-5 p-5 md:grid-cols-[200px_1fr] md:p-6">
        <div className="relative overflow-hidden rounded-[24px] bg-[#16203A]">
          <img
            src={getMealImage(meal, index)}
            alt={meal.name}
            className="h-[180px] w-full object-cover md:h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#16203A]/55 via-transparent to-transparent" />
          <div className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white backdrop-blur">
            Meal {index}
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
              {title}
            </p>
            <p className="mt-1 text-lg font-extrabold text-white">
              {meal.calories} kcal
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#E45C43]">
                {title}
              </p>

              <p className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-[#16203A]">
                {meal.name}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                <span>⏱ Prep time: {meal.minutes} min</span>
                {meal.main_protein && (
                  <span className="capitalize">🥩 {meal.main_protein}</span>
                )}
                {meal.diet_type && (
                  <span className="capitalize">🌿 {meal.diet_type}</span>
                )}
              </div>

              {meal.selection_note && (
                <p className="mt-4 inline-block rounded-2xl border border-[#F6D8A8] bg-[#FFF7E7] px-4 py-2 text-xs font-bold text-[#A87016]">
                  {meal.selection_note}
                </p>
              )}

              {preference && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${preferenceBadgeClass}`}
                  >
                    {preference} Preference
                  </span>

                  {score !== null && score >= 0.85 && (
                    <span className="rounded-full border border-[#F6D8A8] bg-[#FFF7E7] px-3 py-1 text-xs font-bold text-[#A87016]">
                      🔥 Top Recommendation
                    </span>
                  )}
                </div>
              )}

              {score !== null && (
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Match Score: {(score * 100).toFixed(0)}%
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Tag label={`P ${meal.protein_g}g`} />
                <Tag label={`C ${meal.carbs_g}g`} />
                <Tag label={`F ${meal.fat_g}g`} />
                <Tag label={`Fiber ${meal.fiber_g}g`} />
                <Tag label={`Sugar ${meal.sugar_g}g`} />
              </div>

              <p className="mt-4 line-clamp-2 text-sm leading-7 text-slate-600">
                {(meal.ingredients ?? []).slice(0, 7).join(", ")}
                {(meal.ingredients ?? []).length > 7 ? "..." : ""}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-lg font-extrabold text-[#16203A]">
                {meal.calories} kcal
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Target {meal.target_calories} kcal
              </p>

              <button
                type="button"
                onClick={() =>
                  onReplace(
                    meal.slot ?? meal.meal_type,
                    Number(meal.target_calories),
                    Number(meal.recipe_id)
                  )
                }
                className="mt-4 rounded-2xl border border-[#E8E1D8] bg-white px-4 py-2 font-bold text-[#16203A] transition hover:bg-[#FFF7F3]"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMealImage(meal: Meal, index: number) {
  const name = String(meal.name ?? "").toLowerCase();
  const protein = String(meal.main_protein ?? "").toLowerCase();
  const mealType = String(meal.meal_type ?? meal.slot ?? "").toLowerCase();
  const ingredients = (meal.ingredients ?? []).join(" ").toLowerCase();

  const text = `${name} ${protein} ${mealType} ${ingredients}`;

  // Very specific breakfast matches
  if (
    text.includes("protein oats") ||
    text.includes("oats") ||
    text.includes("banana") && text.includes("whey") ||
    text.includes("oatmeal") ||
    text.includes("overnight oats")
  ) {
    return "https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=1200&q=80";
  }

  if (
    text.includes("scramble") ||
    text.includes("omelette") ||
    text.includes("toast") ||
    text.includes("egg breakfast") ||
    text.includes("breakfast")
  ) {
    return "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("yogurt") || text.includes("skyr") || text.includes("granola")) {
    return "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("salmon")) {
    return "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("shrimp") || text.includes("prawn")) {
    return "https://images.unsplash.com/photo-1565299585323-38174c4a6471?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("tuna")) {
    return "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("chicken") && text.includes("rice")) {
    return "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("chicken") && text.includes("broccoli")) {
    return "https://images.unsplash.com/photo-1604908176997-4319cb9b2d9b?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("chicken")) {
    return "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("turkey")) {
    return "https://images.unsplash.com/photo-1604908176997-4319cb9b2d9b?auto=format&fit=crop&w=1200&q=80";
  }

  if (
    text.includes("lentil") ||
    text.includes("chickpea") ||
    text.includes("black bean") ||
    text.includes("beans")
  ) {
    return "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80";
  }

  if (
    text.includes("tofu") ||
    text.includes("tempeh") ||
    text.includes("vegan") ||
    text.includes("vegetarian bowl")
  ) {
    return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("quinoa") || text.includes("rice bowl") || text.includes("bowl")) {
    return "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("salad") || text.includes("kale") || text.includes("greens")) {
    return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("pasta") || text.includes("noodle") || text.includes("spaghetti")) {
    return "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("wrap") || text.includes("sandwich")) {
    return "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?auto=format&fit=crop&w=1200&q=80";
  }

  if (text.includes("plate") || text.includes("dinner") || text.includes("roasted")) {
    return "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80";
  }

  const fallback = [
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  ];

  return fallback[(index - 1) % fallback.length];
}
function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#E8E1D8] bg-[#FBFAF8] px-3 py-1 font-bold text-[#394564]">
      {label}
    </span>
  );
}