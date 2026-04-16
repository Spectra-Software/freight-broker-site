"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AnimatedBackground from "@/components/AnimatedBackground";
import ApplicationModal from "@/components/ApplicationModal";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  return (
    <main className="relative min-h-screen text-white bg-[#070A12] overflow-hidden">

      <AnimatedBackground />

      {/* NAV */}
      <nav className="relative z-10 flex justify-between items-center px-8 py-5 border-b border-white/10 bg-[#0B0F1A]/70 backdrop-blur-xl">
        <h1 className="text-lg font-semibold tracking-wide text-white">
          Broker Buddy
        </h1>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-4 py-2 rounded-lg bg-white text-black hover:bg-gray-200 transition font-medium text-sm"
        >
          Sign in
        </button>
      </nav>

      {/* HERO */}
      <section className="relative z-10 text-center px-6 pt-28 pb-20 max-w-4xl mx-auto">

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-semibold leading-tight tracking-tight"
        >
          Freight Brokerage<br />
          <span className="text-blue-400">built for speed</span>
        </motion.h1>

        <p className="mt-6 text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
          AI-powered tools for brokers — automate outreach, analyze carriers, and optimize fuel decisions in one system.
        </p>

        <div className="mt-8 flex justify-center gap-4">

          <button
            onClick={() => setOpen(true)}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-medium text-sm shadow-lg shadow-blue-600/20"
          >
            Request Access
          </button>

          <button
            className="px-6 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition text-sm text-gray-300"
          >
            Learn More
          </button>
        </div>

        {/* subtle trust line */}
        <p className="mt-6 text-xs text-gray-500">
          Built for independent brokers and small fleets
        </p>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 grid md:grid-cols-3 gap-6 px-8 max-w-6xl mx-auto pb-20">

        {[
          {
            title: "AI Cold Outreach",
            desc: "Generate high-converting carrier emails in seconds."
          },
          {
            title: "Carrier Intelligence",
            desc: "Search, evaluate, and track carriers efficiently."
          },
          {
            title: "Fuel Analytics",
            desc: "Monitor pricing trends and reduce operational costs."
          }
        ].map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 rounded-xl border border-white/10 bg-[#0B0F1A] hover:border-blue-500/30 transition"
          >
            <h3 className="text-sm font-semibold text-blue-400 mb-2">
              {f.title}
            </h3>
            <p className="text-sm text-gray-400">
              {f.desc}
            </p>
          </motion.div>
        ))}
      </section>

      {/* CTA SECTION */}
      <section className="relative z-10 text-center px-6 py-20 border-t border-white/10 bg-[#0B0F1A]/40">

        <h2 className="text-2xl md:text-3xl font-semibold">
          Start scaling your brokerage smarter
        </h2>

        <p className="mt-3 text-gray-400 text-sm">
          Join brokers using automation instead of manual work.
        </p>

        <button
          onClick={() => setOpen(true)}
          className="mt-6 px-7 py-3 rounded-lg bg-white text-black hover:bg-gray-200 transition font-medium text-sm"
        >
          Get Started
        </button>
      </section>

      {/* MODAL */}
      <ApplicationModal open={open} onClose={() => setOpen(false)} />
    </main>
  );
}