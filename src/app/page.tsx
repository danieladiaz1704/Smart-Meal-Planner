"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

type UserType = {
  name?: string;
  email?: string;
} | null;

export default function Landing() {
  const router = useRouter();
  const [user, setUser] = useState<UserType>(null);

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (currentUser) {
      setUser(JSON.parse(currentUser));
    }
  }, []);

  return (
    <main
      className={`${dmSans.className} min-h-screen bg-[#F7F6F3] text-[#171B34] overflow-x-hidden`}
    >
      

      {/* navbar */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#F7F6F3]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[1.65rem] font-extrabold leading-none tracking-tight">
                AI Meal Planner
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Personalized nutrition, beautifully simple
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-8 lg:flex">
            <button
              onClick={() =>
                document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })
              }
              className="text-[1.05rem] font-semibold text-slate-600 transition hover:text-[#171B34]"
            >
              How it Works
            </button>

            <button
              onClick={() =>
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
              }
              className="text-[1.05rem] font-semibold text-slate-600 transition hover:text-[#171B34]"
            >
              Features
            </button>

            {user ? (
              <>
                <button
                  onClick={() => router.push("/planner")}
                  className="text-[1.05rem] font-semibold text-slate-600 transition hover:text-[#171B34]"
                >
                  My Planner
                </button>

                <button
                  onClick={() => router.push("/saved-plans")}
                  className="text-[1.05rem] font-semibold text-slate-600 transition hover:text-[#171B34]"
                >
                  Saved Plans
                </button>

                <button
                  onClick={() => {
                    localStorage.removeItem("currentUser");
                    window.location.reload();
                  }}
                  className="rounded-full bg-[#171B34] px-5 py-2.5 font-bold text-white transition hover:opacity-92"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/login")}
                  className="text-[1.05rem] font-bold text-[#171B34] transition hover:opacity-75"
                >
                  Login
                </button>

                <button
                  onClick={() => router.push("/planner")}
                  className="rounded-full bg-[#6E63F6] px-6 py-3 font-extrabold text-white shadow-[0_12px_30px_rgba(110,99,246,0.22)] transition hover:opacity-92"
                >
                  Create plan →
                </button>
              </>
            )}
          </div>

          {/* mobile actions */}
          <div className="flex items-center gap-2 lg:hidden">
            {user ? (
              <>
                <button
                  onClick={() => router.push("/planner")}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  My Planner
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("currentUser");
                    window.location.reload();
                  }}
                  className="rounded-full bg-[#171B34] px-4 py-2 text-sm font-bold text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/login")}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Login
                </button>
                <button
                  onClick={() => router.push("/planner")}
                  className="rounded-full bg-[#6E63F6] px-4 py-2 text-sm font-extrabold text-white"
                >
                  Plan →
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5">
        {/* hero */}
        <section className="grid gap-14 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          {/* left */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-[#DDD8F9] bg-white px-4 py-2 text-sm font-semibold text-[#6E63F6] shadow-sm">
              AI-powered nutrition planning
            </div>

            <h1 className="mt-8 text-5xl font-extrabold leading-[0.96] tracking-[-0.04em] text-[#171B34] sm:text-6xl lg:text-7xl">
              Eat Fresh.
              <span
                className={`mt-1 block font-medium italic text-[#5B5F86] ${cormorant.className}`}
              >
                Live Better.
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-xl leading-9 text-[#667085] sm:text-2xl sm:leading-10">
              Create your personalized weekly menu around your goals, taste,
              schedule, and lifestyle.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                onClick={() => router.push("/planner")}
                className="rounded-2xl bg-[#6E63F6] px-8 py-4 text-lg font-extrabold text-white shadow-[0_12px_32px_rgba(110,99,246,0.22)] transition hover:opacity-92"
              >
                Create Your Plan →
              </button>

              <button
                onClick={() => router.push("/meal-plan")}
                className="rounded-2xl border border-slate-300 bg-white px-8 py-4 text-lg font-bold text-[#171B34] transition hover:bg-slate-50"
              >
                View last plan
              </button>

              <button
                onClick={() => router.push("/calorie-calculator")}
                className="rounded-2xl border border-slate-300 bg-white px-8 py-4 text-lg font-bold text-[#171B34] transition hover:bg-slate-50"
              >
                Calorie Calculator
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <Tag>Personalized</Tag>
              <Tag>Replace meals</Tag>
              <Tag>Diet-aware</Tag>
              <Tag>Balanced calories</Tag>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-500 sm:text-base">
              <div className="flex -space-x-3">
                <Avatar img="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop" />
                <Avatar img="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop" />
                <Avatar img="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=400&auto=format&fit=crop" />
              </div>
              <span>
                Trusted by <span className="font-bold text-[#171B34]">24,000+</span>{" "}
                food lovers
              </span>
            </div>
          </div>

          {/* right */}
          <div className="relative flex items-center justify-center">
            <div className="absolute right-0 top-0 hidden h-[540px] w-[540px] rounded-[42px] bg-[#ECE9FF] lg:block" />

            <div className="relative z-10 h-[420px] w-full max-w-[520px] overflow-hidden rounded-[40px] bg-white shadow-[0_28px_80px_rgba(23,27,52,0.10)] ring-1 ring-black/5 sm:h-[500px] lg:h-[620px]">
              <img
                src="https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&q=80"
                alt="Healthy premium meal"
                className="h-full w-full object-cover"
              />
            </div>

            <HeroCard
              className="right-4 top-6 sm:right-0 sm:top-10"
              title="CALORIES"
              value="Perfectly Balanced"
              emoji="🔥"
            />

            <HeroCard
              className="-left-2 bottom-10 sm:-left-10"
              title="INGREDIENTS"
              value="Fresh & colorful"
              emoji="🥗"
            />
          </div>
        </section>

        {/* three highlights */}
        <section className="grid gap-5 py-4 md:grid-cols-3">
          <HighlightCard
            title="Set your targets"
            text="Calories, meals per day, goal, allergies, and food preferences."
          />
          <HighlightCard
            title="Get your plan"
            text="A clean weekly structure with balanced meals and smart variety."
          />
          <HighlightCard
            title="Refine anytime"
            text="Replace meals in one click without losing your plan logic."
          />
        </section>

        {/* how it works */}
        <section id="how" className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-extrabold tracking-[-0.04em] text-[#171B34] sm:text-5xl md:text-6xl">
              Smart eating in 3 steps
            </h2>
            <p className="mt-5 text-xl leading-9 text-[#667085] sm:text-2xl">
              We handle the planning, counting, and organizing. You just enjoy
              the food.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            <StepCard
              number="1"
              title="Set your goals"
              text="Tell us what you like to eat and what you want to achieve. We adapt to preferences, diets, and allergies."
            />
            <StepCard
              number="2"
              title="Get your plan"
              text="Receive a complete plan with delicious meals, balanced calories, and structure you can actually follow."
            />
            <StepCard
              number="3"
              title="Cook & stay consistent"
              text="Follow your meals, swap options when needed, and keep progress simple."
            />
          </div>

          <div className="mt-10 flex justify-center">
            <button
              onClick={() => router.push("/planner")}
              className="rounded-full bg-[#6E63F6] px-8 py-4 text-lg font-extrabold text-white shadow-[0_12px_32px_rgba(110,99,246,0.22)] transition hover:opacity-92"
            >
              Start →
            </button>
          </div>
        </section>

        {/* benefits */}
        <section
          id="features"
          className="grid gap-12 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center"
        >
          <div className="relative min-h-[420px]">
            <div className="absolute left-0 top-0 h-56 w-72 overflow-hidden rounded-[32px] shadow-xl sm:h-64 sm:w-80">
              <img
                src="https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200&auto=format&fit=crop"
                alt="Healthy meal one"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="absolute left-28 top-28 h-64 w-80 overflow-hidden rounded-[32px] shadow-xl sm:left-36 sm:h-72 sm:w-96">
              <img
                src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop"
                alt="Healthy meal two"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="absolute left-24 top-24 rounded-[28px] bg-white px-8 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
              <p className="text-4xl font-extrabold text-[#171B34]">1000+</p>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                meal ideas
              </p>
            </div>
          </div>

          <div className="max-w-2xl">
            <h2 className="text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#171B34] sm:text-5xl md:text-6xl">
              Not just a diet.
              <br />
              A lifestyle upgrade.
            </h2>

            <div className="mt-10 space-y-8">
              <Benefit
                title="Fresh ingredients"
                text="Cleaner, more colorful meals that feel enjoyable, not restrictive."
              />
              <Benefit
                title="Save time"
                text="Stop wondering what to eat. Your structure is ready in seconds."
              />
              <Benefit
                title="Sustainable results"
                text="Balanced eating that helps you stay consistent without extremes."
              />
            </div>
          </div>
        </section>

        {/* action strip */}
        <section className="py-16 md:py-20">
          <div className="rounded-[40px] bg-[#171B34] px-8 py-12 text-white shadow-[0_25px_70px_rgba(23,27,52,0.18)] md:px-12 md:py-16">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <h3 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl md:text-5xl">
                  Build a meal plan that actually fits your life
                </h3>
                <p className="mt-4 text-lg leading-8 text-white/70 sm:text-xl">
                  Personalized, elegant, and easy to follow.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => router.push("/planner")}
                  className="rounded-full bg-[#6E63F6] px-8 py-4 text-lg font-extrabold text-white transition hover:opacity-92"
                >
                  Create Your Plan
                </button>

                {!user ? (
                  <button
                    onClick={() => router.push("/login")}
                    className="rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:bg-white/10"
                  >
                    Login
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/saved-plans")}
                    className="rounded-full border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:bg-white/10"
                  >
                    Saved Plans
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="pb-10 text-xs text-slate-500">
          COMP385 — AI-Based Smart Meal Planner (Group Project)
        </footer>
      </div>
    </main>
  );
}

/* UI */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#DDD8F9] bg-white px-3 py-1 text-xs font-semibold text-[#5B5F86] shadow-sm">
      {children}
    </span>
  );
}

function Avatar({ img }: { img: string }) {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-[#F7F6F3] shadow-sm">
      <img src={img} alt="User avatar" className="h-full w-full object-cover" />
    </div>
  );
}

function HeroCard({
  className,
  title,
  value,
  emoji,
}: {
  className: string;
  title: string;
  value: string;
  emoji: string;
}) {
  return (
    <div
      className={`absolute z-20 rounded-[28px] bg-white px-5 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.08)] ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F0FF] text-xl">
          {emoji}
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
            {title}
          </p>
          <p className="text-xl font-extrabold text-[#171B34]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function HighlightCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[28px] border border-black/6 bg-white p-7 shadow-[0_10px_30px_rgba(23,27,52,0.04)]">
      <p className="text-xl font-extrabold text-[#171B34]">{title}</p>
      <p className="mt-3 text-[1.05rem] leading-8 text-[#667085]">{text}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[32px] border border-black/6 bg-white p-8 shadow-[0_10px_30px_rgba(23,27,52,0.04)]">
      <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#5B5F86] text-4xl font-extrabold text-white shadow-lg">
        {number}
      </div>
      <h3 className="mt-8 text-3xl font-extrabold tracking-[-0.03em] text-[#171B34]">
        {title}
      </h3>
      <p className="mt-4 text-xl leading-9 text-[#667085]">{text}</p>
    </div>
  );
}

function Benefit({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#EEF0FF] text-2xl text-[#6E63F6]">
        ✓
      </div>
      <div>
        <h3 className="text-3xl font-extrabold tracking-[-0.03em] text-[#171B34]">
          {title}
        </h3>
        <p className="mt-2 text-xl leading-9 text-[#667085]">{text}</p>
      </div>
    </div>
  );
}