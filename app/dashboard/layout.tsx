"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // 🔐 AUTH + ACCESS GUARD
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.email) {
      router.replace("/");
      return;
    }

    // 🚫 not approved → send to pending page
    if (!session.user.allowed) {
      router.replace("/pending");
      return;
    }
  }, [session, status, router]);

  // 🔄 LOADING STATE
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="animate-pulse text-gray-400">
          Loading dashboard...
        </p>
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "AI Assistant", path: "/dashboard/ai" },
    { name: "Carrier Lookup", path: "/dashboard/carriers" },
    { name: "Fuel Analytics", path: "/dashboard/fuel" },
  ];

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-900 text-white overflow-hidden">

      {/* 🌌 BACKGROUND */}
      <AnimatedBackground />

      {/* WRAPPER */}
      <div className="relative z-10 flex w-full">

        {/* SIDEBAR */}
        <aside className="w-64 p-6 flex flex-col justify-between border-r border-white/10 bg-white/5 backdrop-blur-xl">

          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-bold mb-10"
            >
              Broker Buddy
            </motion.h1>

            <nav className="flex flex-col gap-3">
              {navItems.map((item) => {
                const isActive = pathname === item.path;

                return (
                  <motion.button
                    key={item.path}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => router.push(item.path)}
                    className={`text-left px-4 py-2 rounded-xl transition ${
                      isActive
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                        : "hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    {item.name}
                  </motion.button>
                );
              })}
            </nav>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => signOut()}
            className="mt-10 px-4 py-2 bg-white text-black rounded-xl font-semibold"
          >
            Sign Out
          </motion.button>
        </aside>

        {/* MAIN */}
        <div className="flex-1 flex flex-col">

          {/* TOP BAR */}
          <header className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">

            <motion.h2
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-semibold capitalize"
            >
              {pathname.replace("/dashboard", "") || "Dashboard"}
            </motion.h2>

            <div className="text-sm text-gray-300">
              {session?.user?.email}
            </div>
          </header>

          {/* CONTENT */}
          <main className="p-6">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {children}
            </motion.div>
          </main>

        </div>

      </div>
    </div>
  );
}