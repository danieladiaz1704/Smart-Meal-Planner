"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const API_BASE = "http://127.0.0.1:8000";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Signup failed");
      }

      
      setShowSuccess(true);

    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">

      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        className="absolute left-6 top-6 font-medium text-gray-700 hover:text-black"
      >
        ← Back
      </button>

      {/* Card */}
      <div className="w-[380px] rounded-2xl border border-gray-100 bg-white p-10 shadow-xl">
        <h2 className="mb-2 text-center text-2xl font-bold text-gray-800">
          Create Account
        </h2>

        <p className="mb-6 text-center text-sm text-gray-500">
          Sign up to start building your personalized meal plans
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-800 placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-800 placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
          />

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 rounded-lg py-2 font-semibold text-white transition ${
              loading
                ? "cursor-not-allowed bg-gray-400"
                : "bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90"
            }`}
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <span
            onClick={() => router.push("/login")}
            className="cursor-pointer font-medium text-red-500 hover:underline"
          >
            Login
          </span>
        </p>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[90%] max-w-md rounded-2xl bg-white p-6 shadow-xl">
            
            <h2 className="mb-2 text-xl font-bold text-[#16203A]">
              Account created successfully!
            </h2>

            <p className="mb-6 text-sm text-gray-600">
              Your account is ready. You can now log in and start using Smart Meal Planner.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSuccess(false)}
                className="rounded-full border border-[#E8E1D8] px-4 py-2 text-sm font-bold text-[#16203A] hover:bg-[#FAF8F5]"
              >
                Close
              </button>

              <button
                onClick={() => router.push("/login")}
                className="rounded-full bg-[#E45C43] px-5 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}

    
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[90%] max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="mb-4 font-semibold text-red-500">{error}</p>

            <button
              onClick={() => setError("")}
              className="rounded-lg bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}