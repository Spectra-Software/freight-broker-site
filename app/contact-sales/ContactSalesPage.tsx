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

    const formEl = e.currentTarget;

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

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error("Failed to send");
      }

      setDone(true);
      formEl.reset();
      setSelectedPlan("");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060A] text-white antialiased">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#070A14] via-[#05060A] to-black" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
        <div className="absolute left-1/4 top-[-200px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[160px]" />
        <div className="absolute right-[-100px] bottom-[-100px] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[160px]" />
      </div>

      <div className="mx-auto max-w-2xl px-6 py-16 md:px-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-300">
          ← Back home
        </Link>

        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
          Contact{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Sales</span>
        </h1>
        <p className="mt-4 text-gray-400 text-lg">
          Fill out the form and we will send it to our Sales Team.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8"
        >
          <div>
            <label className="mb-2 block text-sm text-gray-400">Name</label>
            <input
              name="name"
              required
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">Company</label>
            <input
              name="company"
              required
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition"
              placeholder="Company name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">Select Plan</label>
            <select
              name="plan"
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              required
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-gray-300 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition"
            >
              <option value="">Select a plan</option>
              <option value="Starter - $59/mo">Starter - $99/mo</option>
              <option value="Pro - $139/mo">Pro - $299/mo</option>
              <option value="$229">Enterprise - Custom</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">Comments</label>
            <textarea
              name="comments"
              required
              rows={6}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition"
              placeholder="Tell us a little about your team and what you need."
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {done && <p className="text-sm text-emerald-400">Message sent.</p>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </main>
  );
}