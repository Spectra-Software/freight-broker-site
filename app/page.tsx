"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AnimatedBackground from "@/components/AnimatedBackground";
import ApplicationModal from "@/components/ApplicationModal";

function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  return (
    <main className="relative min-h-screen text-white overflow-hidden bg-[#05060A]">

      <AnimatedBackground />

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-4 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <h1 className="text-sm font-medium tracking-wide text-white/80">
          Broker Buddy
        </h1>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 transition"
        >
          Sign In
        </button>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-8 pt-44 pb-28">
        <FadeIn>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight leading-[1.05]">
            Freight brokerage<br />
            <span className="text-white/60">powered by automation</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p className="mt-8 text-lg text-white/50 max-w-xl leading-relaxed">
            Automate cold outreach, analyze carriers, track fuel prices, and scale your brokerage with intelligent workflows.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-10 flex gap-4">
            <button
              onClick={() => setOpen(true)}
              className="px-6 py-3 bg-white text-black text-sm rounded-md hover:bg-white/90 transition"
            >
              Request Access
            </button>

            <button className="px-6 py-3 text-sm text-white/60 hover:text-white transition">
              Learn more →
            </button>
          </div>
        </FadeIn>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-8 pb-28 border-t border-white/10 pt-20">
        <div className="space-y-12">

          {[
            ["AI Email Generator", "Generate high-converting carrier outreach emails instantly."],
            ["Carrier Intelligence", "Analyze carriers and improve lane profitability decisions."],
            ["Fuel Analytics", "Track fuel pricing trends and optimize cost timing."]
          ].map(([title, desc], i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="flex flex-col md:flex-row md:justify-between gap-3 md:gap-12">
                <h3 className="text-white/80 text-base font-medium md:w-1/3">
                  {title}
                </h3>

                <p className="text-white/40 md:w-2/3 leading-relaxed">
                  {desc}
                </p>
              </div>
            </FadeIn>
          ))}

        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 py-28 text-center px-8">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-light">
            Built for modern freight brokers
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p className="text-white/40 mt-4 max-w-xl mx-auto">
            Replace manual workflows with automation-driven tools that scale your brokerage.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <button
            onClick={() => setOpen(true)}
            className="mt-10 px-6 py-3 bg-white text-black rounded-md text-sm hover:bg-white/90 transition"
          >
            Get Started
          </button>
        </FadeIn>
      </section>

      {/* MODAL */}
      <ApplicationModal open={open} onClose={() => setOpen(false)} />
    </main>
  );
}