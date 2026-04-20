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
    { name: "Rate Lookup", path: "/dashboard/rate-lookup" },
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
    <div className="relative flex min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-900 text-white overflow-hidden">
      <AnimatedBackground />

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
                    whileHover={{ scale: 1.03 }}
                    onClick={() => router.push(item.path)}
                    className={`flex items-center justify-between text-left px-4 py-2 rounded-xl transition ${
                      isActive
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                        : "hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    <span>{item.name}</span>

                    {/* 🔵 Gmail-style badge */}
                    {item.name === "Inbox" && newEmails > 0 && (
                      <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
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
          <header className="relative z-40 flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
            <motion.h2
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-semibold capitalize"
            >
              {pathname.replace("/dashboard", "") || "Dashboard"}
            </motion.h2>

            {/* USER MENU */}
            <div className="relative z-50" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-white/15"
              >
                {userInitial.toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {session?.user?.name || "Account"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {session?.user?.email}
                    </p>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/dashboard/settings");
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white"
                    >
                      Account settings
                    </button>

                    {session?.user?.role === "ADMIN" && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/admin");
                        }}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white"
                      >
                        Admin
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-white/10 hover:text-red-200"
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