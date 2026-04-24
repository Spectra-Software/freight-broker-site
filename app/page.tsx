"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type SessionUser = {
  email?: string | null;
  allowed?: boolean;
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const features = [
  {
    icon: "🤖",
    title: "AI-Powered Outreach",
    desc: "Find shippers, draft personalized emails, and send — all from one chat. Cross-referenced with LinkedIn for verified contacts.",
  },
  {
    icon: "📊",
    title: "Lane & Rate Intelligence",
    desc: "Quote any lane instantly with real-time mileage, diesel-adjusted rates, and a built-in profit calculator.",
  },
  {
    icon: "📞",
    title: "Lead Pipeline",
    desc: "Track every prospect from cold call to onboarded. Auto-save AI leads with phone numbers when emails aren't found.",
  },
  {
    icon: "⛽",
    title: "Fuel Analytics",
    desc: "National and regional diesel trends at a glance. Factor fuel costs into every quote automatically.",
  },
  {
    icon: "🚛",
    title: "Carrier Lookup",
    desc: "Search DOT numbers, check safety scores, and filter carriers by equipment type — all in seconds.",
  },
  {
    icon: "✉️",
    title: "Gmail Integration",
    desc: "Drafts land in your inbox for review. One-click send with automatic 14-day follow-ups scheduled.",
  },
];

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const user = session?.user as SessionUser | undefined;
  const isLoggedIn = !!user?.email;
  const isApproved = user?.allowed === true;
  const isUnapproved = isLoggedIn && !isApproved;

  const handleGetStarted = () => {
    router.push("/pricing");
  };

  const handleEnterDashboard = async () => {
    if (!isLoggedIn) {
      await signIn("google", { callbackUrl: "/application-status" });
      return;
    }
    if (isApproved) {
      router.push("/dashboard");
    } else {
      router.push("/application-status");
    }
  };

  const handleAuthButton = async () => {
    if (!isLoggedIn) {
      await signIn("google", { callbackUrl: "/application-status" });
      return;
    }
    if (isUnapproved) {
      await signOut({ redirect: false });
      await signIn("google", { callbackUrl: "/application-status" });
      return;
    }
    await signOut({ callbackUrl: "/" });
  };

  const authButtonLabel = !isLoggedIn
    ? "Sign in with Google"
    : isUnapproved
      ? "Choose Another Google Account"
      : "Logout";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060A] text-white antialiased">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#070A14] via-[#05060A] to-black" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
        <div className="absolute left-1/4 top-[-200px] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[160px] animate-blob1" />
        <div className="absolute right-[-100px] top-[30%] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[160px] animate-blob2" />
        <div className="absolute left-[-100px] bottom-[-100px] h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[160px] animate-blob3" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#05060A]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 font-bold text-sm backdrop-blur-xl transition group-hover:border-indigo-500/30 group-hover:shadow-lg group-hover:shadow-indigo-500/10">
              BB
            </div>
            <div>
              <div className="text-xs text-gray-500 tracking-wider uppercase">Broker Buddy</div>
              <div className="text-sm font-semibold tracking-tight">Freight OS</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/pricing" className="rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:text-white hover:bg-white/[0.06]">Pricing</Link>
            <Link href="/contact-sales" className="rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:text-white hover:bg-white/[0.06]">Contact Sales</Link>
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={handleEnterDashboard} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-300 backdrop-blur-xl transition hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12]">
              Enter Dashboard
            </button>
            <button onClick={handleAuthButton} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-100 active:scale-[0.98]">
              {authButtonLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.section ref={heroRef} style={{ y: heroY, opacity: heroOpacity }} className="mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-20 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:pb-32 md:pt-28">
        <div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] px-4 py-1.5 text-sm text-indigo-300 backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Built for modern freight brokers
          </motion.div>

          <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={1} className="max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight md:text-7xl">
            Run your brokerage{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              like a product.
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} initial="hidden" animate="visible" custom={2} className="mt-6 max-w-xl text-lg leading-8 text-gray-400">
            Automate carrier outreach, compare lane data, and track fuel trends
            from one clean workspace designed to help brokers move faster.
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button onClick={handleGetStarted} className="group relative rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98]">
              <span className="relative z-10">Get Started</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 opacity-0 transition group-hover:opacity-100" />
            </button>
            <Link href="/contact-sales" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-7 py-3.5 font-semibold text-gray-300 backdrop-blur-xl transition hover:bg-white/[0.06] hover:text-white hover:border-white/[0.12] active:scale-[0.98]">
              Contact Sales
            </Link>
          </motion.div>
        </div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="relative">
          <div className="absolute -inset-4 rounded-[36px] bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-violet-500/10 blur-2xl" />
          <div className="relative rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-3 shadow-2xl backdrop-blur-2xl">
            <div className="rounded-[18px] border border-white/[0.06] bg-[#080B14] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Today</div>
                  <div className="text-lg font-semibold">Broker Dashboard</div>
                </div>
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-medium">
                  Live
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">AI Assistant</div>
                  <div className="mt-2 text-sm font-medium text-gray-200">
                    Ask for an email, lane, or carrier summary.
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs text-gray-400 border border-white/[0.04]">
                      &ldquo;Find 5 carriers for Dallas to Atlanta&rdquo;
                    </div>
                    <div className="rounded-xl bg-indigo-500/10 px-3 py-2.5 text-xs text-indigo-300 border border-indigo-500/10">
                      &ldquo;3 strong matches found. 1 needs review.&rdquo;
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Outreach</div>
                    <div className="mt-2 text-2xl font-bold">12</div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                      <div className="h-1.5 w-[72%] rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Fuel margin</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-400">+2.7%</div>
                    <div className="mt-1 text-xs text-gray-500">Better than last week</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Active carriers</div>
                    <div className="mt-2 text-2xl font-bold">342</div>
                    <div className="mt-1 text-xs text-gray-500">Filtered by score & safety</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Features */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 md:px-8">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="text-center">
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl font-bold tracking-tight md:text-5xl">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">move freight</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="mx-auto mt-4 max-w-2xl text-gray-400 text-lg">
            One platform to find leads, quote lanes, track carriers, and close deals — powered by AI.
          </motion.p>
        </motion.div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              custom={i}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition hover:border-white/[0.1] hover:bg-white/[0.04]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-xl transition group-hover:border-indigo-500/20 group-hover:bg-indigo-500/10">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="relative mx-auto max-w-7xl px-6 py-20 md:px-8">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-8 md:grid-cols-3">
          {[
            { value: "2,400+", label: "Brokers onboarded" },
            { value: "98%", label: "Email delivery rate" },
            { value: "14min", label: "Average first response" },
          ].map((stat, i) => (
            <motion.div key={stat.label} variants={fadeUp} custom={i} className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent md:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 md:px-8">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 via-[#0A0D18] to-cyan-500/10 p-12 text-center md:p-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_60%)]" />
          <motion.h2 variants={fadeUp} custom={0} className="relative text-3xl font-bold tracking-tight md:text-5xl">
            Ready to move faster?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="relative mx-auto mt-4 max-w-lg text-gray-400 text-lg">
            Join thousands of brokers who close more deals with less busywork.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button onClick={handleGetStarted} className="group relative rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-8 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98]">
              Get Started Free
            </button>
            <Link href="/contact-sales" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-8 py-3.5 font-semibold text-gray-300 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.98]">
              Talk to Sales
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#05060A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-bold">BB</div>
            <span className="text-sm text-gray-500">Broker Buddy &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-sm text-gray-500 transition hover:text-gray-300">Pricing</Link>
            <Link href="/contact-sales" className="text-sm text-gray-500 transition hover:text-gray-300">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}