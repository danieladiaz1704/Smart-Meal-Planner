"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Sex = "female" | "male";
type Goal = "maintain" | "deficit" | "surplus";
type Activity = "sedentary" | "light" | "moderate" | "very" | "extra";

function activityMultiplier(a: Activity) {
  switch (a) {
    case "sedentary":
      return 1.2;
    case "light":
      return 1.375;
    case "moderate":
      return 1.55;
    case "very":
      return 1.725;
    case "extra":
      return 1.9;
  }
}

function bmr(sex: Sex, wKg: number, hCm: number, age: number) {
  // Mifflin-St Jeor
  const base = 10 * wKg + 6.25 * hCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number) {
  return new Intl.NumberFormat(undefined).format(n);
}

function activityLabel(a: Activity) {
  switch (a) {
    case "sedentary":
      return "Sedentary (little/no exercise)";
    case "light":
      return "Light (1–3 days/week)";
    case "moderate":
      return "Moderate (3–5 days/week)";
    case "very":
      return "Very Active (6–7 days/week)";
    case "extra":
      return "Extra Active (athlete/physical job)";
  }
}

function goalLabel(goal: Goal) {
  switch (goal) {
    case "maintain":
      return "Maintain";
    case "deficit":
      return "Fat Loss";
    case "surplus":
      return "Muscle Gain";
  }
}

function goalHint(goal: Goal) {
  switch (goal) {
    case "maintain":
      return "Estimated maintenance calories.";
    case "deficit":
      return "A moderate deficit to support fat loss.";
    case "surplus":
      return "A small surplus to support muscle gain.";
  }
}

function sexLabel(sex: Sex) {
  return sex === "female" ? "Female" : "Male";
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <label className="text-sm font-medium text-gray-800">{label}</label>
        {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function UnitPill({ text }: { text: string }) {
  return (
    <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
      {text}
    </span>
  );
}

export default function CalorieCalculator() {
  
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState<string>("22");
  const [height, setHeight] = useState<string>("165");
  const [weight, setWeight] = useState<string>("60");
  const [activity, setActivity] = useState<Activity>("moderate");
  const [goal, setGoal] = useState<Goal>("maintain");

  //deficit/surplus
  const [deltaPct, setDeltaPct] = useState<number>(goal === "deficit" ? 15 : goal === "surplus" ? 10 : 0);

  
  const deltaPctNormalized = useMemo(() => {
    if (goal === "maintain") return 0;
    if (goal === "deficit") return clamp(deltaPct, 10, 25);
    return clamp(deltaPct, 5, 15);
  }, [goal, deltaPct]);

  const parsed = useMemo(() => {
    const a = clamp(parseFloat(age), 10, 90);
    const h = clamp(parseFloat(height), 120, 220);
    const w = clamp(parseFloat(weight), 30, 250);
    return { a, h, w };
  }, [age, height, weight]);

  const result = useMemo(() => {
    const base = bmr(sex, parsed.w, parsed.h, parsed.a);
    const tdee = base * activityMultiplier(activity);

    let recommended = tdee;

    if (goal === "deficit") {
      recommended = tdee * (1 - deltaPctNormalized / 100);
    } else if (goal === "surplus") {
      recommended = tdee * (1 + deltaPctNormalized / 100);
    }

    
    // protein range 1.6–2.2 g/kg (
    const proteinLow = Math.round(parsed.w * 1.6);
    const proteinHigh = Math.round(parsed.w * 2.2);

    return {
      bmr: Math.round(base),
      tdee: Math.round(tdee),
      recommended: Math.round(recommended),
      proteinRange: `${proteinLow}–${proteinHigh} g/day`,
    };
  }, [sex, parsed, activity, goal, deltaPctNormalized]);

  const profile = `${parsed.w} kg · ${parsed.h} cm · ${parsed.a} yrs · ${sexLabel(sex)} · ${activityLabel(activity)}`;

  const badge =
    goal === "maintain"
      ? { title: "Maintenance", sub: "Keep weight stable" }
      : goal === "deficit"
      ? { title: `Deficit (-${deltaPctNormalized}%)`, sub: "Fat loss support" }
      : { title: `Surplus (+${deltaPctNormalized}%)`, sub: "Muscle gain support" };

  return (
    <main className="min-h-screen bg-[#f8f1f1] px-6 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-7 flex flex-col gap-2">
          <Link href="/" className="inline-flex items-center text-sm text-gray-700 hover:underline w-fit">
            ← Back
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Calorie Calculator</h1>
              <p className="text-gray-600 mt-1">
                Enter your stats to estimate BMR, TDEE, and a recommended daily calorie target.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-800 shadow-sm">
                {badge.title}
              </span>
              <span className="text-sm text-gray-600">{badge.sub}</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* LEFT */}
          <section className="bg-white rounded-2xl shadow p-7 md:p-8 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Your details</h2>
            <p className="text-sm text-gray-600 mt-1 mb-6">
              Make sure the values are accurate for best results.
            </p>

            <div className="space-y-5">
              <Field label="Sex">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSex("female")}
                    className={[
                      "px-4 py-3 rounded-xl border text-sm font-medium transition",
                      sex === "female"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-800 border-gray-200 hover:border-gray-300",
                    ].join(" ")}
                  >
                    Female
                  </button>
                  <button
                    type="button"
                    onClick={() => setSex("male")}
                    className={[
                      "px-4 py-3 rounded-xl border text-sm font-medium transition",
                      sex === "male"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-800 border-gray-200 hover:border-gray-300",
                    ].join(" ")}
                  >
                    Male
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Age" hint="10–90">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="22"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                    <UnitPill text="yrs" />
                  </div>
                </Field>

                <Field label="Height" hint="120–220">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={120}
                      max={220}
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="165"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                    <UnitPill text="cm" />
                  </div>
                </Field>

                <Field label="Weight" hint="30–250">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={30}
                      max={250}
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="60"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                    <UnitPill text="kg" />
                  </div>
                </Field>
              </div>

              <Field label="Activity level">
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as Activity)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="sedentary">Sedentary (little/no exercise)</option>
                  <option value="light">Light (1–3 days/week)</option>
                  <option value="moderate">Moderate (3–5 days/week)</option>
                  <option value="very">Very Active (6–7 days/week)</option>
                  <option value="extra">Extra Active (athlete/physical job)</option>
                </select>
              </Field>

              <Field label="Goal">
                <div className="grid grid-cols-3 gap-3">
                  {(["maintain", "deficit", "surplus"] as Goal[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setGoal(g);
                        
                        if (g === "maintain") setDeltaPct(0);
                        if (g === "deficit") setDeltaPct(15);
                        if (g === "surplus") setDeltaPct(10);
                      }}
                      className={[
                        "px-4 py-3 rounded-xl border text-sm font-medium transition",
                        goal === g
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-800 border-gray-200 hover:border-gray-300",
                      ].join(" ")}
                    >
                      {goalLabel(g)}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-gray-500 mt-2">{goalHint(goal)}</p>

                {goal !== "maintain" && (
                  <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800">
                        {goal === "deficit" ? "Deficit intensity" : "Surplus intensity"}
                      </p>
                      <span className="text-sm text-gray-700">
                        {goal === "deficit" ? `-${deltaPctNormalized}%` : `+${deltaPctNormalized}%`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={goal === "deficit" ? 10 : 5}
                      max={goal === "deficit" ? 25 : 15}
                      value={deltaPctNormalized}
                      onChange={(e) => setDeltaPct(parseFloat(e.target.value))}
                      className="w-full mt-3"
                    />

                    <p className="text-xs text-gray-500 mt-2">
                      {goal === "deficit"
                        ? "Most people do well with 10–20%. Avoid aggressive deficits long-term."
                        : "A small surplus is usually enough. Bigger isn’t always better."}
                    </p>
                  </div>
                )}
              </Field>
            </div>
          </section>

          {/* RIGHT */}
          <section className="bg-white rounded-2xl shadow p-7 md:p-8 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Your results</h2>
            <p className="text-sm text-gray-600 mt-1 mb-6">
              <span className="font-medium text-gray-900">You entered:</span> {profile}
            </p>

            <div className="grid gap-4">
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600">BMR</p>
                <p className="text-3xl font-bold text-gray-900">{fmt(result.bmr)} kcal/day</p>
                <p className="text-xs text-gray-500 mt-1">Calories your body needs at complete rest.</p>
              </div>

              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600">TDEE</p>
                <p className="text-3xl font-bold text-gray-900">{fmt(result.tdee)} kcal/day</p>
                <p className="text-xs text-gray-500 mt-1">Estimated maintenance calories based on activity.</p>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white shadow">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm opacity-90">
                    Recommended — {goalLabel(goal)}
                  </p>
                  <span className="text-xs bg-white/15 rounded-full px-3 py-1">
                    {goal === "maintain"
                      ? "0%"
                      : goal === "deficit"
                      ? `-${deltaPctNormalized}%`
                      : `+${deltaPctNormalized}%`}
                  </span>
                </div>

                <p className="text-4xl font-extrabold mt-2">{fmt(result.recommended)} kcal/day</p>

                <div className="mt-4 p-4 rounded-xl bg-white/10">
                  <p className="text-sm font-medium">Protein suggestion</p>
                  <p className="text-sm opacity-90">{result.proteinRange}</p>
                  <p className="text-xs opacity-80 mt-1">
                    Useful for training contexts; adjust to preference and diet.
                  </p>
                </div>
              </div>

              <div className="text-xs text-gray-500 leading-relaxed">
                Tip: Use this as a starting point. Track body weight/measurements for 2–3 weeks and adjust calories up/down
                based on real progress.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}