"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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

type DietType = "vegan" | "vegetarian" | "non-vegetarian";
type GoalType = "lose_weight" | "maintain" | "gain_muscle";
type PrepTimePreference = "any" | "quick" | "moderate";
type MacroPreference = "balanced" | "high_protein" | "high_carb" | "lower_carb";

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
    dislikes: "",
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
    likes: [],
    dislikes: toCsvList(form.dislikes),
    favorite_meal_types: [],
    preferred_prep_time: null,
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
    <main className={`${manrope.className} min-h-screen bg-[#FFF8F4] text-[#171B34]`}>
      <div className="mx-auto max-w-6xl px-5 py-8 md:py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="rounded-full border border-[#FED7AA] bg-white px-5 py-3 text-sm font-extrabold text-[#171B34] shadow-[0_8px_24px_rgba(23,27,52,0.05)] transition hover:bg-[#FFF7ED]"
          >
            ← Back
          </button>

          <div className="hidden items-center gap-3 rounded-full border border-[#FED7AA] bg-white px-5 py-2.5 shadow-[0_8px_24px_rgba(23,27,52,0.05)] sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F97316]" />
            <p className="text-sm font-extrabold tracking-[-0.01em] text-[#3D4466]">
              Smart Meal Planner
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-[36px] border border-[#FDE7D8] bg-white shadow-[0_24px_80px_rgba(23,27,52,0.08)]">
          <div className="border-b border-[#FDE7D8] bg-[linear-gradient(180deg,#FFF3EC_0%,#FFFFFF_100%)] px-6 py-8 md:px-8 md:py-9">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex rounded-full border border-[#FED7AA] bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F97316] shadow-sm">
                Personalized planner
              </p>

              <h1 className="text-4xl font-extrabold tracking-[-0.05em] text-[#171B34] md:text-5xl">
                Generate your plan
              </h1>

              <p className="mt-3 max-w-2xl text-[17px] font-medium leading-8 text-[#535B7A] md:text-[18px]">
                Build a meal plan around your goals, food preferences, allergies,
                and routine with a cleaner, more personalized experience.
              </p>
            </div>
          </div>

          <div className="space-y-7 px-6 py-7 md:px-8 md:py-8">
            <SectionHeader
              eyebrow="Basics"
              title="Your plan foundation"
              desc="Set your calorie target, daily structure, and nutrition goal."
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Calories per day">
                <input
                  type="number"
                  value={form.calories}
                  onChange={(e) =>
                    setForm({ ...form, calories: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Meals per day (1–6)">
                <input
                  type="number"
                  value={form.meals_per_day}
                  onChange={(e) =>
                    setForm({ ...form, meals_per_day: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Days (1–14)">
                <input
                  type="number"
                  value={form.days}
                  onChange={(e) =>
                    setForm({ ...form, days: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Diet type">
                <select
                  value={form.diet_type}
                  onChange={(e) =>
                    setForm({ ...form, diet_type: e.target.value as DietType })
                  }
                  className={inputClass}
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
                  className={inputClass}
                >
                  <option value="lose_weight">Lose weight</option>
                  <option value="maintain">Maintain</option>
                  <option value="gain_muscle">Gain muscle</option>
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
                  className={inputClass}
                >
                  <option value="balanced">Balanced</option>
                  <option value="high_protein">High protein</option>
                  <option value="high_carb">High carb</option>
                  <option value="lower_carb">Lower carb</option>
                </select>
              </Field>
            </div>

            <SectionHeader
              eyebrow="Preferences"
              title="Flavor and restrictions"
              desc="Add allergies, dislikes, and prep-time preferences."
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Allergies (comma separated)">
                <input
                  type="text"
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  placeholder="nuts, dairy"
                  className={inputClass}
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
                  className={inputClass}
                >
                  <option value="any">Any</option>
                  <option value="quick">Quick meals</option>
                  <option value="moderate">Moderate</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <Field label="Dislikes (comma separated)">
                <input
                  type="text"
                  value={form.dislikes}
                  onChange={(e) => setForm({ ...form, dislikes: e.target.value })}
                  placeholder="tofu, mushrooms"
                  className={inputClass}
                />
              </Field>
            </div>

            <SectionHeader
              eyebrow="Personalization"
              title="Protein choices"
              desc="Select your favorite proteins so the recommendations feel more like you."
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-1">
              <div className="rounded-[30px] border border-[#FDE7D8] bg-[#FFF8F4] p-5 shadow-[0_12px_30px_rgba(23,27,52,0.04)]">
                <div className="mb-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
                    Planner modes
                  </p>
                  <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-[#171B34]">
                    Extra filters
                  </h3>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-[#F3E8E2] bg-white px-4 py-4 text-sm font-bold text-[#171B34] shadow-sm">
                    <input
                      type="checkbox"
                      checked={form.exclude_ultra_processed}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          exclude_ultra_processed: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[#F97316]"
                    />
                    Exclude ultra-processed
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-[#F3E8E2] bg-white px-4 py-4 text-sm font-bold text-[#171B34] shadow-sm">
                    <input
                      type="checkbox"
                      checked={form.variety}
                      onChange={(e) =>
                        setForm({ ...form, variety: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#F97316]"
                    />
                    Variety mode
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#FDE7D8] bg-[#FFF8F4] p-5 shadow-[0_12px_30px_rgba(23,27,52,0.04)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
                    Protein picker
                  </p>
                  <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-[#171B34]">
                    Favorite proteins
                  </h3>
                </div>

                <div className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#5B5F86] shadow-sm">
                  {form.favorite_proteins.length} selected
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-[24px] border border-[#F3E8E2] bg-white p-3 shadow-inner">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PROTEIN_OPTIONS.map((protein) => {
                    const checked = form.favorite_proteins.includes(protein);

                    return (
                      <label
                        key={protein}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-bold transition ${
                          checked
                            ? "border-[#F97316] bg-[#FFF1F2] text-[#171B34] shadow-sm"
                            : "border-[#F3E8E2] bg-white text-[#3D4466] hover:bg-[#FFF7ED]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFavoriteProtein(protein)}
                          className="h-4 w-4 accent-[#F97316]"
                        />
                        <span>{protein}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {loading && (
              <div className="rounded-[30px] border border-[#FED7AA] bg-[#FFF7ED] p-5 shadow-[0_12px_30px_rgba(249,115,22,0.10)]">
                <div className="mb-3 flex items-center justify-between text-sm font-extrabold text-[#4A4F78]">
                  <span>Generating with AI…</span>
                  <span>{progress}%</span>
                </div>

                <div className="h-4 w-full overflow-hidden rounded-full bg-white ring-1 ring-[#FAD7C3]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#F97316_0%,#FB7185_100%)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full rounded-[24px] bg-[linear-gradient(90deg,#F97316_0%,#FB7185_100%)] px-6 py-4 text-lg font-extrabold text-white shadow-[0_18px_36px_rgba(249,115,22,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate Plan"}
            </button>

            {error && (
              <div className="rounded-[24px] border border-[#E7C5CF] bg-[#FFF7FA] p-4 text-sm font-bold text-[#A33A5B]">
                {error}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-[20px] border border-[#FED7AA] bg-white px-4 py-3.5 text-[15px] font-semibold text-[#171B34] shadow-[0_4px_18px_rgba(23,27,52,0.04)] outline-none transition placeholder:text-[#8A90A8] focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/12";

function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[28px] border border-[#FDE7D8] bg-[#FFF8F4] px-5 py-5 shadow-[0_10px_26px_rgba(23,27,52,0.04)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#171B34]">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] font-medium leading-7 text-[#535B7A]">
        {desc}
      </p>
    </div>
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
    <div className="space-y-2.5">
      <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#3D4466]">
        {label}
      </p>
      {children}
    </div>
  );
}