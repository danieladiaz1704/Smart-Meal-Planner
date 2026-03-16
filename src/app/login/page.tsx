"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // Get users from localStorage
  const users = JSON.parse(localStorage.getItem("users") || "[]");

  // Find the user by email
  const user = users.find((u: any) => u.email === email);

  // If user does not exist
  if (!user) {
    alert("User not found. Please sign up first.");
    return;
  }

  // If password is incorrect
  if (user.password !== password) {
    alert("Incorrect password");
    return;
  }

  // Save logged-in user session
  localStorage.setItem("currentUser", JSON.stringify(user));

  // Redirect to planner page
  router.push("/planner");
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 relative">

      {/* Back Button */}
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
            onChange={(e)=>setEmail(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
          />

          <p className="text-sm text-gray-500 text-right cursor-pointer hover:text-gray-700">
            Forgot password?
          </p>

          <button
            type="submit"
            className="mt-2 bg-gradient-to-r from-red-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:opacity-90 transition duration-200"
          >
            Login
          </button>

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

    </div>
  );
}