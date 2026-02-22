"use client";

import { useRouter } from "next/navigation";

export default function Landing() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50 text-slate-900 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-28 -left-28 h-96 w-96 rounded-full bg-rose-300/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-[28rem] w-[28rem] rounded-full bg-orange-300/45 blur-3xl" />

      {/* TOP PROMO BANNER */}
      <div className="relative z-10">
        <div className="w-full bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 text-white">
          <div className="mx-auto max-w-6xl px-5 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <span className="text-amber-200">⏳</span> Limited demo build
              </span>
              <span className="text-white/80">
                Generate a plan in seconds • Replace meals • Beautiful summaries
              </span>
            </div>

            <button
              onClick={() => router.push("/planner")}
              className="rounded-full bg-white text-slate-900 px-4 py-1.5 text-xs sm:text-sm font-extrabold hover:opacity-90 transition"
            >
              Try it now →
            </button>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-10 space-y-16">
        {/* NAVBAR */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-rose-600 to-orange-500 shadow-sm" />
            <div>
              <p className="font-extrabold leading-tight">Smart Meal Planner</p>
              <p className="text-xs text-slate-500 -mt-0.5">
                AI-powered meal planning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })
              }
              className="hidden sm:inline-flex rounded-2xl px-4 py-2 border border-slate-200 bg-white font-semibold hover:border-rose-200 transition"
            >
              How it works
            </button>

            <button
              onClick={() =>
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
              }
              className="hidden sm:inline-flex rounded-2xl px-4 py-2 border border-slate-200 bg-white font-semibold hover:border-rose-200 transition"
            >
              Features
            </button>

            <button
              onClick={() => router.push("/planner")}
              className="rounded-2xl px-4 py-2 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-extrabold hover:opacity-95 transition"
            >
              Create plan →
            </button>
          </div>
        </header>

        {/* HERO */}
        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
          {/* LEFT */}
          <div className="space-y-6 animate-fadeUp">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 py-2 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <p className="text-xs sm:text-sm font-extrabold text-rose-700">
                AI-Powered Nutrition Planning
              </p>
            </div>

            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Eat Smart.{" "}
              <span className="bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent">
                Live Better.
              </span>
            </h1>

            <p className="text-lg text-slate-600 max-w-xl">
              Build a personalized meal plan around your goals: calories, diet, allergies,
              and preferences. Our system generates a structured plan you can actually follow,
              with balanced meals and a clear nutrition breakdown.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => router.push("/planner")}
                className="rounded-2xl px-8 py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-extrabold shadow-lg hover:opacity-95 hover:scale-[1.01] transition"
              >
                Create Your Plan →
              </button>

              <button
                onClick={() => router.push("/meal-plan")}
                className="rounded-2xl px-8 py-4 border border-slate-200 bg-white font-bold hover:border-rose-200 transition"
              >
                View last plan
              </button>
              <button
                onClick={() => router.push("/calorie-calculator")}
               className="rounded-2xl px-8 py-4 border border-slate-200 bg-white font-bold hover:border-rose-200 transition"
              >
                Calorie Calculator
              </button>
              
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Tag>Goal-based ranking</Tag>
              <Tag>Diet & allergies</Tag>
              <Tag>Replace meals</Tag>
              <Tag>Explainable rules</Tag>
              <Tag>Fast generation</Tag>
            </div>

            {/* trust-ish row */}
            <div className="flex flex-wrap items-center gap-3 pt-3 text-sm text-slate-500">
              <div className="flex -space-x-2">
                <Avatar />
                <Avatar />
                <Avatar />
                <Avatar />
              </div>
              <span className="font-semibold text-slate-700">4.8</span>
              <Stars />
              <span>Designed for consistency, not guesswork</span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="relative flex justify-center animate-fadeUp">
            {/* Big image circle */}
            <div className="relative w-[380px] h-[380px] rounded-[36px] overflow-hidden shadow-2xl border border-white bg-white">
              <img
                src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80"
                alt="Healthy meal"
                className="object-cover w-full h-full"
              />
              {/* overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-600/10 via-transparent to-orange-500/10" />
            </div>

            {/* Floating badges */}
            <FloatCard className="-top-6 -left-6" emoji="🔥" title="Calories" value="Perfectly balanced" />
            <FloatCard className="top-10 -right-8" emoji="🥑" title="Diet" value="Personalized to you" />
            <FloatCard className="bottom-6 -right-6" emoji="⚡" title="Speed" value="Generated in seconds" />

            {/* Glow */}
            <div className="absolute -z-10 w-[460px] h-[460px] bg-gradient-to-r from-rose-200 to-orange-200 blur-3xl rounded-full opacity-70"></div>
          </div>
        </section>

        {/* LOGO STRIP */}
        <section className="space-y-4">
          <p className="text-xs text-slate-500 font-semibold tracking-wide">
            BUILT WITH MODERN STACK
          </p>
          <div className="flex flex-wrap gap-3">
            <MiniLogo>Next.js</MiniLogo>
            <MiniLogo>FastAPI</MiniLogo>
            <MiniLogo>Pandas</MiniLogo>
            <MiniLogo>Tailwind</MiniLogo>
            <MiniLogo>Rule-based AI</MiniLogo>
            <MiniLogo>Content ranking</MiniLogo>
          </div>
        </section>

        {/* PROBLEM / SOLUTION */}
        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="The problem"
            desc="Planning meals takes time and mental energy — balancing calories, diet preferences, allergies, and nutrition can feel overwhelming."
            icon={<IconBolt />}
          />
          <InfoCard
            title="What happens"
            desc="People default to fast food or repetitive meals that don’t match their goals because decisions become too costly."
            icon={<IconLoop />}
          />
          <InfoCard
            title="Our solution"
            desc="A structured meal plan generated from your inputs, with clear totals and the option to replace meals for better fit."
            icon={<IconSpark />}
          />
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl font-extrabold">How it works</h2>
            <button
              onClick={() => router.push("/planner")}
              className="rounded-2xl px-5 py-3 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-extrabold hover:opacity-95 transition"
            >
              Start →
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Step
              idx="01"
              title="Set your targets"
              desc="Choose calories, meals/day, days, diet type, goal, and allergies."
            />
            <Step
              idx="02"
              title="AI filtering + ranking"
              desc="We filter foods by constraints and rank options based on your goal."
            />
            <Step
              idx="03"
              title="Generate + refine"
              desc="Get your plan with totals, then replace meals anytime for variety."
            />
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="space-y-6">
          <h2 className="text-3xl font-extrabold">Features built for real life</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Feature
              title="Structured plans"
              desc="Daily or multi-day planning with clear meal breakdowns and totals."
              emoji="📅"
            />
            <Feature
              title="Goal-aligned ranking"
              desc="Different scoring depending on your objective (lose, maintain, gain)."
              emoji="🎯"
            />
            <Feature
              title="Diet + allergy constraints"
              desc="Respect preferences and filter known allergens by ingredient hints."
              emoji="🧠"
            />
            <Feature
              title="Replace meals"
              desc="One click to regenerate a meal while keeping the same constraints."
              emoji="🔁"
            />
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden rounded-[32px] border bg-white/75 backdrop-blur p-8 shadow-sm">
          <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-fuchsia-300/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-300/35 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-extrabold">
                Create your meal plan in under a minute.
              </h3>
              <p className="text-slate-600 max-w-2xl">
                No more stress. No more guessing. Just a clean plan tailored to your inputs —
                with simple controls to refine it.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push("/planner")}
                className="rounded-2xl px-8 py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-extrabold hover:opacity-95 transition"
              >
                Generate now →
              </button>
              <button
                onClick={() => router.push("/meal-plan")}
                className="rounded-2xl px-8 py-4 border border-slate-200 bg-white font-bold hover:border-rose-200 transition"
              >
                View last plan
              </button>
            </div>
          </div>
        </section>

        <footer className="text-xs text-slate-500">
          COMP385 — AI-Based Smart Meal Planner (Group Project)
        </footer>
      </div>
    </main>
  );
}

/*  UI components */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-rose-100 text-rose-800 px-3 py-1 text-xs font-semibold">
      {children}
    </span>
  );
}

function MiniLogo({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
      {children}
    </span>
  );
}

function Avatar() {
  return (
    <div className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-rose-600 to-orange-500 shadow-sm" />
  );
}

function Stars() {
  return (
    <span className="text-amber-400 tracking-tight">
      ★★★★☆
    </span>
  );
}

function FloatCard({
  className,
  emoji,
  title,
  value,
}: {
  className: string;
  emoji: string;
  title: string;
  value: string;
}) {
  return (
    <div
      className={`absolute ${className} bg-white/90 backdrop-blur rounded-2xl shadow-xl px-4 py-3 border border-slate-100`}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-lg">
          {emoji}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500">{title}</p>
          <p className="text-sm font-extrabold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-rose-100 bg-white/80 backdrop-blur p-6 shadow-[0_10px_30px_rgba(244,63,94,0.06)]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-rose-600 to-orange-500 text-white flex items-center justify-center">
          {icon}
        </div>
        <p className="font-extrabold">{title}</p>
      </div>
      <p className="text-sm text-slate-600 mt-3">{desc}</p>
    </div>
  );
}

function Step({ idx, title, desc }: { idx: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-rose-100 bg-white/80 backdrop-blur p-6 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-extrabold">{title}</p>
        <span className="text-xs font-extrabold text-rose-600">{idx}</span>
      </div>
      <p className="text-sm text-slate-600 mt-2">{desc}</p>
    </div>
  );
}

function Feature({ title, desc, emoji }: { title: string; desc: string; emoji: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex gap-4">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-600 to-orange-500 text-white flex items-center justify-center text-xl">
        {emoji}
      </div>
      <div>
        <p className="font-extrabold">{title}</p>
        <p className="text-sm text-slate-600 mt-1">{desc}</p>
      </div>
    </div>
  );
}



function IconBolt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 2L3 14h8l-1 8 11-14h-8l0-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconLoop() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l1.5 6L20 10l-6.5 2L12 18l-1.5-6L4 10l6.5-2L12 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
