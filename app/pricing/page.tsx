"use client";

import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "$49",
    description: "For small teams getting started.",
    features: ["AI emails", "Basic carrier search", "Fuel snapshots"],
  },
  {
    name: "Growth",
    price: "$149",
    description: "For active brokerage teams.",
    features: ["Everything in Starter", "Advanced analytics", "Priority support"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For larger operations.",
    features: ["Custom workflows", "Team roles", "Dedicated onboarding"],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#050816] px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back home
          </Link>
          <h1 className="mt-4 text-4xl font-bold">Pricing</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Placeholder pricing for now. We can adjust these tiers whenever you are ready.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl border p-6 ${
                plan.featured
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <div className="mt-3 text-4xl font-bold">{plan.price}</div>
              <p className="mt-3 text-gray-400">{plan.description}</p>

              <ul className="mt-6 space-y-3 text-sm text-gray-300">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>

              <div className="mt-8">
                <Link
                  href="/contact-sales"
                  className="inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-gray-200"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}