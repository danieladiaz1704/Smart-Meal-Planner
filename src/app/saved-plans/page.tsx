"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const API_BASE = "http://127.0.0.1:8000";

type Meal = {
  meal_type: string;
  slot?: string;
  recipe_id?: number;
  name: string;
  minutes: number;
  target_calories?: number;
  calories: number;
  protein_g: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
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
  totals?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
  };
};

type SavedPlan = {
  meta?: {
    days?: number;
    meals_per_day?: number;
    diet_type?: string;
    goal?: string;
    prep_time_preference?: string;
  };
  days: DayPlan[];
};

export default function SavedPlansPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [activePlan, setActivePlan] = useState(0);
  const [activeDay, setActiveDay] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

      if (!currentUser?.email) {
        router.push("/login");
        return;
      }

      const res = await fetch(`${API_BASE}/saved-plans/${currentUser.email}`);
      const data = await res.json();

      if (data?.status === "ok") {
        setPlans(data.plans || []);
        setActivePlan(0);
        setActiveDay(data.plans?.[0]?.days?.[0]?.day ?? 1);
      } else {
        setError("Failed to load saved plans");
      }
    } catch (error) {
      console.error("Failed to fetch saved plans:", error);
      setError("Failed to load saved plans");
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleDelete = async (index: number) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

      if (!currentUser?.email) return;

      const res = await fetch(`${API_BASE}/delete-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentUser.email,
          index,
        }),
      });

      const data = await res.json();

      if (data?.status === "ok") {
        await fetchPlans();
      }
    } catch (error) {
      console.error("Failed to delete plan:", error);
      setError("Failed to delete plan");
    }
  };

  const currentPlan = plans[activePlan] ?? null;
  const days = currentPlan?.days ?? [];

  const activeDayObj = useMemo(
    () => days.find((d) => d.day === activeDay) ?? days[0] ?? null,
    [days, activeDay]
  );

  const computedDayTotals = useMemo(() => {
    if (!activeDayObj?.meals?.length) {
      return {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      };
    }

    return activeDayObj.meals.reduce(
      (acc, meal) => {
        acc.calories += Number(meal.calories || 0);
        acc.protein_g += Number(meal.protein_g || 0);
        acc.carbs_g += Number(meal.carbs_g || 0);
        acc.fat_g += Number(meal.fat_g || 0);
        return acc;
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );
  }, [activeDayObj]);

  const overallTotals = useMemo(() => {
    if (!currentPlan?.days?.length) {
      return {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      };
    }

    return currentPlan.days.reduce(
      (acc, day) => {
        for (const meal of day.meals ?? []) {
          acc.calories += Number(meal.calories || 0);
          acc.protein_g += Number(meal.protein_g || 0);
          acc.carbs_g += Number(meal.carbs_g || 0);
          acc.fat_g += Number(meal.fat_g || 0);
        }
        return acc;
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );
  }, [currentPlan]);

  if (!currentPlan) {
    return (
      <main className={`${manrope.className} min-h-screen bg-[#F8F6F2] text-[#16203A]`}>
        <div className="mx-auto max-w-4xl px-5 py-12">
          <div className="overflow-hidden rounded-[32px] border border-[#E8E1D8] bg-white shadow-[0_22px_70px_rgba(22,32,58,0.08)]">
            <div className="grid gap-6 p-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E45C43]">
                  Saved plans
                </p>
                <p className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">
                  No saved plans yet
                </p>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Save a meal plan first so you can review it here anytime.
                </p>
                <button
                  onClick={() => router.push("/planner")}
                  className="mt-6 rounded-2xl bg-[#E45C43] px-5 py-3 font-bold text-white shadow-[0_16px_34px_rgba(228,92,67,0.22)] transition hover:opacity-95"
                >
                  Create a Plan
                </button>
              </div>

              <div className="overflow-hidden rounded-[28px] ring-1 ring-black/5">
                <img
                  src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80"
                  alt="Healthy bowl"
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-full border border-[#E8E1D8] bg-white px-5 py-3 font-bold text-[#16203A] shadow-sm transition hover:bg-[#FAF8F5]"
            >
              Home
            </button>

            <button
              onClick={() => router.push("/planner")}
              className="rounded-full border border-[#E8E1D8] bg-white px-5 py-3 font-bold text-[#16203A] shadow-sm transition hover:bg-[#FAF8F5]"
            >
              Create New Plan
            </button>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-[#F2D1C9] bg-white px-4 py-2 shadow-sm sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E45C43]" />
            <p className="text-sm font-bold text-[#A54334]">Saved Plans</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-[#F0C7CF] bg-[#FFF7FA] p-4 text-sm font-semibold text-[#A33A5B]">
            {error}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[34px] border border-[#E8E1D8] bg-white shadow-[0_26px_80px_rgba(22,32,58,0.08)]">
              <div className="grid gap-5 border-b border-[#F0EBE4] bg-[linear-gradient(180deg,#FFF8F4_0%,#FFFFFF_100%)] p-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E45C43]">
                    Saved snapshot
                  </p>
                  <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                    {activeDayObj
                      ? `Plan ${activePlan + 1} • Day ${activeDayObj.day} • ${computedDayTotals.calories.toFixed(1)} kcal`
                      : "Saved plan"}
                  </h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-7 text-slate-600">
                    Review your saved meal plan with the same clean layout, daily meals,
                    and nutrition summary.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleDelete(activePlan)}
                      className="rounded-2xl bg-[#E45C43] px-5 py-3 font-bold text-white shadow-[0_18px_36px_rgba(228,92,67,0.22)] transition hover:opacity-95"
                    >
                      Delete This Plan
                    </button>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] bg-[#16203A] shadow-[0_18px_50px_rgba(22,32,58,0.22)]">
                  <img
                    src={getDayImage(activeDayObj?.day ?? 1)}
                    alt="Saved meal plan visual"
                    className="h-[220px] w-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#16203A]/70 via-[#16203A]/20 to-transparent" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
                    Saved plan
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
                        {currentPlan?.meta?.goal
                          ? String(currentPlan.meta.goal).replaceAll("_", " ")
                          : "Balanced"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-[#F0EBE4] px-6 py-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {plans.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setActivePlan(index);
                        setActiveDay(plans[index]?.days?.[0]?.day ?? 1);
                      }}
                      className={[
                        "rounded-full px-4 py-2 text-sm font-bold border transition",
                        activePlan === index
                          ? "bg-[#16203A] text-white border-[#16203A] shadow-[0_10px_24px_rgba(22,32,58,0.18)]"
                          : "bg-white text-slate-700 border-[#E8E1D8] hover:bg-[#FFF7F3]",
                      ].join(" ")}
                    >
                      Plan {index + 1}
                    </button>
                  ))}
                </div>

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
                      <SavedMealCard
                        key={`${m.recipe_id ?? idx}-${idx}`}
                        meal={m}
                        index={idx + 1}
                      />
                    ))}

                    <div className="grid gap-4 pt-2 sm:grid-cols-3">
                      <Stat title="Protein" value={`${computedDayTotals.protein_g.toFixed(1)} g`} />
                      <Stat title="Carbs" value={`${computedDayTotals.carbs_g.toFixed(1)} g`} />
                      <Stat title="Fat" value={`${computedDayTotals.fat_g.toFixed(1)} g`} />
                    </div>

                    <div className="rounded-[28px] border border-[#E8E1D8] bg-[#FBFAF8] p-5">
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E45C43]">
                        Saved overview
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        This page keeps your saved plans easy to review with the same
                        visual structure as your original meal plan page.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat title="Plan calories" value={`${overallTotals.calories.toFixed(1)} kcal`} />
              <Stat title="Protein" value={`${overallTotals.protein_g.toFixed(1)} g`} />
              <Stat title="Carbs" value={`${overallTotals.carbs_g.toFixed(1)} g`} />
              <Stat title="Fat" value={`${overallTotals.fat_g.toFixed(1)} g`} />
            </div>
          </div>

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
                    Saved overview
                  </p>
                  <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-white">
                    Your saved meals, ready anytime
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SidebarMiniStat
                    label="Saved plans"
                    value={String(plans.length)}
                  />
                  <SidebarMiniStat
                    label="Days planned"
                    value={String(currentPlan?.meta?.days ?? currentPlan?.days?.length ?? 0)}
                  />
                  <SidebarMiniStat
                    label="Meals/day"
                    value={String(currentPlan?.meta?.meals_per_day ?? activeDayObj?.meals?.length ?? 0)}
                  />
                  <SidebarMiniStat
                    label="Diet"
                    value={formatMeta(currentPlan?.meta?.diet_type)}
                  />
                </div>
              </div>
            </div>
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
        No day selected
      </p>
      <p className="mt-2 text-sm text-slate-600">Choose a saved day to view meals.</p>
    </div>
  );
}

function SavedMealCard({
  meal,
  index,
}: {
  meal: Meal;
  index: number;
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
                <Tag label={`P ${meal.protein_g ?? 0}g`} />
                <Tag label={`C ${meal.carbs_g ?? 0}g`} />
                <Tag label={`F ${meal.fat_g ?? 0}g`} />
                <Tag label={`Fiber ${meal.fiber_g ?? 0}g`} />
                <Tag label={`Sugar ${meal.sugar_g ?? 0}g`} />
              </div>

              {!!meal.ingredients?.length && (
                <p className="mt-4 line-clamp-2 text-sm leading-7 text-slate-600">
                  {meal.ingredients.slice(0, 7).join(", ")}
                  {meal.ingredients.length > 7 ? "..." : ""}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-lg font-extrabold text-[#16203A]">
                {meal.calories} kcal
              </p>
              {meal.target_calories !== undefined && (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Target {meal.target_calories} kcal
                </p>
              )}
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

  if (
    text.includes("protein oats") ||
    text.includes("oats") ||
    (text.includes("banana") && text.includes("whey")) ||
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