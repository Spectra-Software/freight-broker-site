"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const plans = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    description: "For small teams getting started.",
    features: ["AI emails", "Basic carrier search", "Fuel snapshots"],
  },
  {
    name: "Growth",
    price: "$149",
    period: "/mo",
    description: "For active brokerage teams.",
    features: ["Everything in Starter", "Advanced analytics", "Priority support"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For larger operations.",
    features: ["Custom workflows", "Team roles", "Dedicated onboarding"],
  },
];

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060A] text-white antialiased">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#070A14] via-[#05060A] to-black" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
        <div className="absolute left-1/4 top-[-200px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[160px]" />
        <div className="absolute right-[-100px] bottom-[-100px] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[160px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-16 md:px-8">
        <motion.div initial="hidden" animate="visible" className="mb-12">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-300">
            ← Back home
          </Link>
          <motion.h1 variants={fadeUp} custom={0} className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
            Simple, transparent{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">pricing</span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={1} className="mt-4 max-w-2xl text-gray-400 text-lg">
            Start small, scale fast. No hidden fees, no surprises.
          </motion.p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i + 1}
              className={`group relative rounded-2xl border p-8 transition ${
                plan.featured
                  ? "border-indigo-500/30 bg-indigo-500/[0.06] shadow-lg shadow-indigo-500/10"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-1 text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-gray-500 text-sm">{plan.period}</span>}
              </div>
              <p className="mt-3 text-sm text-gray-400">{plan.description}</p>

              <ul className="mt-6 space-y-3 text-sm text-gray-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link
                  href={plan.featured ? "/contact-sales?plan=Growth" : `/contact-sales?plan=${plan.name}`}
                  className={`inline-flex rounded-xl px-6 py-3 font-semibold transition active:scale-[0.98] ${
                    plan.featured
                      ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30"
                      : "border border-white/[0.08] bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  Get Started
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}