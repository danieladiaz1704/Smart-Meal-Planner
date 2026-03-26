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
        <label className="text-sm font-medium text-[#171B34]">{label}</label>
        {hint ? <span className="text-xs text-[#8A90A8]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function UnitPill({ text }: { text: string }) {
  return (
    <span className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-1 text-xs font-medium text-[#F97316]">
      {text}
    </span>
  );
}

function SectionTitle({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold tracking-tight text-[#171B34]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[#667085]">{desc}</p>
    </div>
  );
}

export default function CalorieCalculator() {
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState<string>("22");
  const [height, setHeight] = useState<string>("165");
  const [weight, setWeight] = useState<string>("60");
  const [activity, setActivity] = useState<Activity>("moderate");
  const [goal, setGoal] = useState<Goal>("maintain");
  const [deltaPct, setDeltaPct] = useState<number>(
    goal === "deficit" ? 15 : goal === "surplus" ? 10 : 0
  );

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

    const proteinLow = Math.round(parsed.w * 1.6);
    const proteinHigh = Math.round(parsed.w * 2.2);

    return {
      bmr: Math.round(base),
      tdee: Math.round(tdee),
      recommended: Math.round(recommended),
      proteinRange: `${proteinLow}–${proteinHigh} g/day`,
    };
  }, [sex, parsed, activity, goal, deltaPctNormalized]);

  const profile = `${parsed.w} kg · ${parsed.h} cm · ${parsed.a} yrs · ${sexLabel(
    sex
  )} · ${activityLabel(activity)}`;

  const badge =
    goal === "maintain"
      ? { title: "Maintenance", sub: "Keep weight stable" }
      : goal === "deficit"
      ? { title: `Deficit (-${deltaPctNormalized}%)`, sub: "Fat loss support" }
      : { title: `Surplus (+${deltaPctNormalized}%)`, sub: "Muscle gain support" };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FFF7ED] via-white to-[#FFE4E6] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[#FDE7D8] bg-white/90 px-4 py-2.5 text-sm font-medium text-[#5B5F86] shadow-[0_10px_24px_rgba(23,27,52,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#FED7AA] hover:text-[#171B34] hover:shadow-[0_14px_30px_rgba(23,27,52,0.08)]"
          >
            <span className="text-base leading-none">←</span>
            <span>Back</span>
          </Link>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-[#FED7AA] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#F97316] shadow-sm">
                Smart nutrition tool
              </p>

              <h1 className="text-4xl font-semibold tracking-tight text-[#171B34] md:text-5xl">
                Calorie Calculator
              </h1>

              <p className="mt-2 max-w-2xl text-[17px] leading-8 text-[#667085]">
                Enter your stats to estimate BMR, TDEE, and a recommended daily
                calorie target with a cleaner, more personalized experience.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#FED7AA] bg-white px-4 py-2 text-sm font-medium text-[#171B34] shadow-sm">
                {badge.title}
              </span>
              <span className="text-sm font-normal text-[#667085]">
                {badge.sub}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* LEFT */}
          <section className="rounded-[28px] border border-[#FDE7D8] bg-white/90 p-7 shadow-[0_20px_60px_rgba(23,27,52,0.08)] backdrop-blur md:p-8">
            <SectionTitle
              title="Your details"
              desc="Make sure the values are accurate for best results."
            />

            <div className="space-y-6">
              <Field label="Sex">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSex("female")}
                    className={[
                      "rounded-2xl border px-4 py-3.5 text-sm font-medium transition",
                      sex === "female"
                        ? "border-transparent bg-gradient-to-r from-[#F97316] to-[#FB7185] text-white shadow-md"
                        : "border-gray-200 bg-white text-gray-800 hover:border-[#F97316]",
                    ].join(" ")}
                  >
                    Female
                  </button>

                  <button
                    type="button"
                    onClick={() => setSex("male")}
                    className={[
                      "rounded-2xl border px-4 py-3.5 text-sm font-medium transition",
                      sex === "male"
                        ? "border-transparent bg-gradient-to-r from-[#F97316] to-[#FB7185] text-white shadow-md"
                        : "border-gray-200 bg-white text-gray-800 hover:border-[#F97316]",
                    ].join(" ")}
                  >
                    Male
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Age" hint="10–90">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="22"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
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
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
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
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                    />
                    <UnitPill text="kg" />
                  </div>
                </Field>
              </div>

              <Field label="Activity level">
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as Activity)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-gray-900 focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="sedentary">
                    Sedentary (little/no exercise)
                  </option>
                  <option value="light">Light (1–3 days/week)</option>
                  <option value="moderate">Moderate (3–5 days/week)</option>
                  <option value="very">Very Active (6–7 days/week)</option>
                  <option value="extra">
                    Extra Active (athlete/physical job)
                  </option>
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
                        "rounded-2xl border px-4 py-3.5 text-sm font-medium transition",
                        goal === g
                          ? "border-transparent bg-gradient-to-r from-[#F97316] to-[#FB7185] text-white shadow-md"
                          : "border-gray-200 bg-white text-gray-800 hover:border-[#F97316]",
                      ].join(" ")}
                    >
                      {goalLabel(g)}
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-xs text-[#667085]">{goalHint(goal)}</p>

                {goal !== "maintain" && (
                  <div className="mt-4 rounded-2xl border border-[#FDE7D8] bg-gradient-to-br from-[#FFF7ED] to-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#171B34]">
                        {goal === "deficit"
                          ? "Deficit intensity"
                          : "Surplus intensity"}
                      </p>
                      <span className="text-sm font-medium text-[#F97316]">
                        {goal === "deficit"
                          ? `-${deltaPctNormalized}%`
                          : `+${deltaPctNormalized}%`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={goal === "deficit" ? 10 : 5}
                      max={goal === "deficit" ? 25 : 15}
                      value={deltaPctNormalized}
                      onChange={(e) => setDeltaPct(parseFloat(e.target.value))}
                      className="mt-3 w-full accent-[#F97316]"
                    />

                    <p className="mt-2 text-xs leading-relaxed text-[#667085]">
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
          <section className="rounded-[28px] border border-[#FDE7D8] bg-white/90 p-7 shadow-[0_20px_60px_rgba(23,27,52,0.08)] backdrop-blur md:p-8">
            <SectionTitle
              title="Your results"
              desc={`You entered: ${profile}`}
            />

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-[#FDE7D8] bg-gradient-to-br from-white to-[#FFF7ED] p-5">
                <p className="text-sm font-medium text-[#667085]">BMR</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-[#171B34]">
                  {fmt(result.bmr)} kcal/day
                </p>
                <p className="mt-2 text-sm text-[#667085]">
                  Calories your body needs at complete rest.
                </p>
              </div>

              <div className="rounded-[24px] border border-[#FDE7D8] bg-gradient-to-br from-white to-[#FFF7ED] p-5">
                <p className="text-sm font-medium text-[#667085]">TDEE</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-[#171B34]">
                  {fmt(result.tdee)} kcal/day
                </p>
                <p className="mt-2 text-sm text-[#667085]">
                  Estimated maintenance calories based on activity.
                </p>
              </div>

              <div className="rounded-[26px] bg-gradient-to-r from-[#F97316] via-[#FB7185] to-[#F43F5E] p-6 text-white shadow-[0_20px_50px_rgba(249,115,22,0.35)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white/90">
                    Recommended — {goalLabel(goal)}
                  </p>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {goal === "maintain"
                      ? "0%"
                      : goal === "deficit"
                      ? `-${deltaPctNormalized}%`
                      : `+${deltaPctNormalized}%`}
                  </span>
                </div>

                <p className="mt-3 text-[42px] font-semibold tracking-tight">
                  {fmt(result.recommended)} kcal/day
                </p>

                <div className="mt-5 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-sm font-medium">Protein suggestion</p>
                  <p className="mt-1 text-lg font-medium">
                    {result.proteinRange}
                  </p>
                  <p className="mt-1 text-xs text-white/80">
                    Useful for training contexts; adjust to preference and diet.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#FDE7D8] bg-white p-4 text-sm leading-7 text-[#667085]">
                Tip: Use this as a starting point. Track body
                weight/measurements for 2–3 weeks and adjust calories up or down
                based on real progress.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}