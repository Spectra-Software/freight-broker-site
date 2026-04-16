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
    <main className="relative min-h-screen text-white bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">

      <AnimatedBackground />

      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-6 py-4 backdrop-blur-md bg-white/5 border-b border-white/10 relative z-10">
        <h1 className="text-xl font-bold tracking-wide">
          Broker Buddy
        </h1>

        {/* ONLY SIGN IN HERE */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 hover:scale-105 transition font-semibold"
        >
          Sign In
        </button>
      </nav>

      {/* HERO */}
      <section className="text-center px-6 pt-28 pb-16 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-extrabold leading-tight"
        >
          Freight Brokerage <br />
          <span className="text-blue-400">Powered by AI</span>
        </motion.h2>

        <p className="mt-6 text-gray-300 text-lg max-w-2xl mx-auto">
          Automate cold emails, analyze carriers, track fuel prices, and close more freight deals faster than ever.
        </p>

        <div className="mt-8 flex gap-4 justify-center">
          
          {/* REQUEST ACCESS → MODAL */}
          <button
            onClick={() => setOpen(true)}
            className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 transition hover:scale-105 font-semibold"
          >
            Request Access
          </button>

          <button className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 transition hover:scale-105">
            Learn More
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid md:grid-cols-3 gap-6 px-10 py-16 max-w-6xl mx-auto relative z-10">
        {["AI Email Generator", "Carrier Intelligence", "Fuel Analytics"].map((title, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:border-blue-500 transition"
          >
            <h3 className="text-lg font-semibold mb-2 text-blue-400">
              {title}
            </h3>
            <p className="text-gray-300">
              Powerful tools to scale your freight brokerage faster.
            </p>
          </motion.div>
        ))}
      </section>

      {/* CTA */}
      <section className="text-center py-20 border-t border-white/10 relative z-10">
        <h2 className="text-3xl font-bold">
          Start Closing More Loads Today
        </h2>

        <p className="text-gray-400 mt-3">
          Join brokers using AI to scale smarter.
        </p>

        {/* GET STARTED → MODAL */}
        <button
          onClick={() => setOpen(true)}
          className="mt-6 px-8 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 transition hover:scale-105 font-semibold"
        >
          Get Started
        </button>
      </section>

      {/* MODAL */}
      <ApplicationModal open={open} onClose={() => setOpen(false)} />

    </main>
  );
}