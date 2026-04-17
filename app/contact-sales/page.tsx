"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ContactSalesPage() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");

  // ✅ AUTO-FILL PLAN FROM URL
  useEffect(() => {
    const planFromUrl = searchParams.get("plan");
    if (planFromUrl) {
      setSelectedPlan(planFromUrl);
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formEl = e.currentTarget; // ✅ FIX: store form reference

    setLoading(true);
    setError("");
    setDone(false);

    const form = new FormData(formEl);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      company: String(form.get("company") || ""),
      comments: String(form.get("comments") || ""),
      plan: selectedPlan || String(form.get("plan") || ""),
    };

    try {
      const res = await fetch("/api/contact-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json(); // ✅ FIX: parse response

      if (!res.ok || !data.success) {
        throw new Error("Failed to send");
      }

      setDone(true);
      formEl.reset(); // ✅ FIX: safe reset
      setSelectedPlan(""); // reset dropdown
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">
          ← Back home
        </Link>

        <h1 className="mt-4 text-4xl font-bold">Contact Sales</h1>
        <p className="mt-3 text-gray-400">
          Fill out the form and we will send it to austin@haulorafreight.com.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          {/* NAME */}
          <div>
            <label className="mb-2 block text-sm text-gray-300">Name</label>
            <input
              name="name"
              required
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-gray-500"
              placeholder="Your name"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="mb-2 block text-sm text-gray-300">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-gray-500"
              placeholder="you@company.com"
            />
          </div>

          {/* COMPANY */}
          <div>
            <label className="mb-2 block text-sm text-gray-300">Company</label>
            <input
              name="company"
              required
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-gray-500"
              placeholder="Company name"
            />
          </div>

          {/* PLAN DROPDOWN */}
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Select Plan
            </label>
            <select
              name="plan"
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none text-gray-300 focus:border-blue-500"
            >
              <option value="">Select a plan</option>
              <option value="Starter - $99/mo">Starter - $99/mo</option>
              <option value="Pro - $299/mo">Pro - $299/mo</option>
              <option value="Enterprise - Custom">Enterprise - Custom</option>
            </select>
          </div>

          {/* COMMENTS */}
          <div>
            <label className="mb-2 block text-sm text-gray-300">Comments</label>
            <textarea
              name="comments"
              required
              rows={6}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-gray-500"
              placeholder="Tell us a little about your team and what you need."
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {done && <p className="text-sm text-emerald-400">Message sent.</p>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}