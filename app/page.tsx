"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();

  const handleGetStarted = () => {
    router.push("/pricing");
  };

  const handleEnterDashboard = async () => {
    if (!session?.user?.email) {
      await signIn("google", { callbackUrl: "/dashboard" });
      return;
    }

    if (session.user.allowed) {
      router.push("/dashboard");
    } else {
      router.push("/contact-sales");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-240px] h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[180px]" />
        <div className="absolute right-[-180px] top-[20%] h-[560px] w-[560px] rounded-full bg-violet-500/15 blur-[180px]" />
        <div className="absolute left-[-180px] bottom-[-180px] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_20%)]" />
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 font-bold backdrop-blur-xl">
            BB
          </div>
          <div>
            <div className="text-sm text-gray-400">Broker Buddy</div>
            <div className="text-base font-semibold tracking-tight">Freight OS</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Link
            href="/pricing"
            className="rounded-xl px-4 py-2 text-sm text-gray-300 transition hover:bg-white/8 hover:text-white"
          >
            Pricing
          </Link>
          <Link
            href="/contact-sales"
            className="rounded-xl px-4 py-2 text-sm text-gray-300 transition hover:bg-white/8 hover:text-white"
          >
            Contact Sales
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={handleEnterDashboard}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/10"
          >
            Enter Dashboard
          </button>

          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
          >
            Sign in with Google
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-10 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:pb-28 md:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Built for modern freight brokers
          </div>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Run your brokerage
            <span className="mt-3 block bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              like a product.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-gray-400 md:text-lg">
            Automate carrier outreach, compare lane data, and track fuel trends
            from one clean workspace designed to help brokers move faster.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button
              onClick={handleGetStarted}
              className="rounded-2xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              Get Started
            </button>

            <Link
              href="/contact-sales"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 font-semibold text-white/90 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              Contact Sales
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="relative"
        >
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="rounded-[24px] border border-white/10 bg-[#07111f] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400">Today</div>
                  <div className="text-xl font-semibold">Broker dashboard</div>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                  Live
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-gray-400">AI Assistant</div>
                  <div className="mt-2 text-lg font-semibold">
                    Ask for an email, lane, or carrier summary.
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-black/30 px-4 py-3 text-sm text-gray-300">
                      “Find 5 carriers for Dallas to Atlanta”
                    </div>
                    <div className="rounded-2xl bg-blue-500/15 px-4 py-3 text-sm text-blue-100">
                      “3 strong matches found. 1 needs review.”
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-gray-400">Outreach</div>
                    <div className="mt-2 text-3xl font-semibold">12</div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-2 w-[72%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-gray-400">Fuel margin</div>
                    <div className="mt-2 text-3xl font-semibold">+2.7%</div>
                    <div className="mt-1 text-sm text-emerald-300">
                      Better than last week
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-gray-400">Active carriers</div>
                    <div className="mt-2 text-3xl font-semibold">342</div>
                    <div className="mt-1 text-sm text-gray-400">
                      Filtered by score and safety
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}