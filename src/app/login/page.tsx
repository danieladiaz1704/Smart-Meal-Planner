"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const API_BASE = "http://127.0.0.1:8000";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/login`, {
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
        throw new Error(data?.detail || "Login failed");
      }

      localStorage.setItem("currentUser", JSON.stringify(data.user));
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 relative">
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 left-6 text-gray-700 hover:text-black font-medium"
      >
        ← Back
      </button>

      <div className="bg-white p-10 rounded-2xl shadow-xl w-[380px] border border-gray-100">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Smart Meal Planner Login
        </h2>

        <p className="text-sm text-gray-500 text-center mb-6">
          Sign in to generate your personalized meal plans
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
          />

          <p className="text-sm text-gray-500 text-right cursor-pointer hover:text-gray-700">
            Forgot password?
          </p>

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 py-2 rounded-lg font-semibold transition duration-200 text-white ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90"
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          {loading && (
            <p className="text-sm text-gray-500 text-center mt-1">
              Please wait...
            </p>
          )}
        </form>

        <p className="text-sm text-gray-600 text-center mt-4">
          Don’t have an account?{" "}
          <span
            onClick={() => router.push("/signup")}
            className="text-red-500 font-medium cursor-pointer hover:underline"
          >
            Sign up
          </span>
        </p>
      </div>

      {error && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80 text-center">
            <p className="text-red-500 font-semibold mb-4">{error}</p>

            <button
              onClick={() => setError("")}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}