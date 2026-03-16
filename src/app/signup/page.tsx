"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    // Get existing users from localStorage
    const users = JSON.parse(localStorage.getItem("users") || "[]");

    // Check if user already exists
    const existingUser = users.find((u: any) => u.email === email);

    if (existingUser) {
      alert("User already exists. Please login.");
      return;
    }

    // Create new user object
    const newUser = {
      email: email,
      password: password,
      meals: []
    };

    // Add new user to the users list
    users.push(newUser);

    // Save updated users list
    localStorage.setItem("users", JSON.stringify(users));

    alert("Account created successfully!");

    router.push("/login");
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
          Create Account
        </h2>

        <p className="text-sm text-gray-500 text-center mb-6">
          Join Smart Meal Planner
        </p>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400"
          />

          <button
            type="submit"
            className="mt-3 bg-gradient-to-r from-red-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:opacity-90"
          >
            Sign Up
          </button>

        </form>

        <p className="text-sm text-gray-600 text-center mt-4">
          Already have an account?{" "}
          <span
            onClick={() => router.push("/login")}
            className="text-red-500 font-medium cursor-pointer hover:underline"
          >
            Login
          </span>
        </p>

      </div>

    </div>
  );
}