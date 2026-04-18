"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

type AppStatus = "NONE" | "PENDING" | "APPROVED" | "DENIED";

export default function ApplicationStatusPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const user = session?.user as
    | {
        allowed?: boolean;
        status?: AppStatus;
      }
    | undefined;

  const appStatus = user?.status ?? "NONE";
  const isApproved = user?.allowed === true;

  useEffect(() => {
    if (sessionStatus === "authenticated" && isApproved) {
      router.replace("/dashboard");
    }
  }, [sessionStatus, isApproved, router]);

  if (sessionStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816] px-6 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-gray-300 backdrop-blur-xl">
          Loading...
        </div>
      </main>
    );
  }

  const statusMessage =
    appStatus === "PENDING"
      ? "Your application is still pending approval."
      : appStatus === "DENIED"
      ? "Your application has been denied."
      : "You must submit an application to use this platform.";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] px-6 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-240px] h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[180px]" />
        <div className="absolute right-[-180px] top-[20%] h-[560px] w-[560px] rounded-full bg-violet-500/15 blur-[180px]" />
        <div className="absolute left-[-180px] bottom-[-180px] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_20%)]" />
      </div>

      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">
          ← Back home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mt-4 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-2xl md:p-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Application status
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight">
            Account access
          </h1>

          <p className="mt-3 text-gray-400">{statusMessage}</p>

          {appStatus !== "NONE" && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-gray-400">Current status</div>
              <div className="mt-1 text-lg font-semibold uppercase tracking-wide">
                {appStatus}
              </div>
            </div>
          )}

          {appStatus === "NONE" && (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/contact-sales"
                className="rounded-2xl bg-blue-600 px-6 py-3.5 text-center font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                Contact Sales
              </Link>

              <Link
                href="/pricing"
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-center font-semibold text-white/90 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Pricing
              </Link>
            </div>
          )}

          {appStatus === "NONE" && (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-gray-300">
              You have not submitted an application yet.
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}