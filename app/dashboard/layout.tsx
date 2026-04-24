"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [newEmails, setNewEmails] = useState(3); // 👈 Gmail badge state
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.email) {
      router.replace("/");
      return;
    }

    if (!session.user.allowed) {
      router.replace("/contact-sales");
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="animate-pulse text-gray-400">Loading dashboard...</p>
      </div>
    );
  }

  // ✅ NAV ITEMS (FIXED + INBOX ADDED)
  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Inbox", path: "/dashboard/inbox", badge: newEmails }, // 👈 ADDED
    { name: "AI Assistant", path: "/dashboard/ai" },
    { name: "Leads", path: "/dashboard/leads" },
    { name: "Quote A Lane", path: "/dashboard/rate-lookup" },
    { name: "Carrier Lookup", path: "/dashboard/carriers" },
    { name: "Fuel Analytics", path: "/dashboard/fuel" },
    ...(session?.user?.role === "ADMIN"
      ? [{ name: "Admin", path: "/admin" }]
      : []),
  ];

  const userInitial =
    session?.user?.name?.[0] ||
    session?.user?.email?.[0] ||
    "U";

  return (
    <div className="relative flex min-h-screen bg-[#05060A] text-white overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 flex w-full">
        {/* SIDEBAR */}
        <aside className="w-64 p-6 flex flex-col justify-between border-r border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-10"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 font-bold text-sm">BB</div>
              <div>
                <div className="text-xs text-gray-500 tracking-wider uppercase">Broker Buddy</div>
                <div className="text-sm font-semibold tracking-tight">Freight OS</div>
              </div>
            </motion.div>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path;

                return (
                  <motion.button
                    key={item.path}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(item.path)}
                    className={`flex items-center justify-between text-left px-4 py-2.5 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-500/20 to-cyan-500/10 text-white border border-indigo-500/20 shadow-lg shadow-indigo-500/10"
                        : "hover:bg-white/[0.04] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <span>{item.name}</span>

                    {item.name === "Inbox" && newEmails > 0 && (
                      <span className="ml-2 text-xs bg-indigo-500/80 text-white px-2 py-0.5 rounded-full">
                        {newEmails}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* MAIN AREA */}
        <div className="flex-1 flex flex-col">
          {/* HEADER */}
          <header className="relative z-40 flex justify-between items-center px-6 py-4 border-b border-white/[0.06] bg-[#05060A]/60 backdrop-blur-2xl">
            <motion.h2
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
              className="text-base font-semibold capitalize text-gray-200"
            >
              {pathname.replace("/dashboard", "") || "Dashboard"}
            </motion.h2>

            {/* USER MENU */}
            <div className="relative z-50" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-sm font-semibold text-white transition hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.96]"
              >
                {userInitial.toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0D18]/95 shadow-2xl backdrop-blur-2xl">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {session?.user?.name || "Account"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session?.user?.email}
                    </p>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/dashboard/settings");
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition"
                    >
                      Account settings
                    </button>

                    {session?.user?.role === "ADMIN" && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/admin");
                        }}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition"
                      >
                        Admin
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-400 hover:bg-white/[0.06] hover:text-rose-300 transition"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="p-6">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}