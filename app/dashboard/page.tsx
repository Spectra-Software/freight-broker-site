"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardStats = {
  emailsSent: number;
  newEmails: number;
  followUpCount: number;
  closestFollowUp: {
    id: string;
    scheduledAt: string | null;
    to: string;
    subject: string;
  } | null;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready to send";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [now, setNow] = useState(Date.now());

  // Carrier lookup state
  const [lookupType, setLookupType] = useState<"DOT" | "MC">("DOT");
  const [lookupValue, setLookupValue] = useState("");

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // non-critical
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Tick countdown every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCarrierLookup = () => {
    if (!lookupValue.trim()) return;
    const param = lookupType === "DOT" ? "dot" : "mc";
    router.push(`/dashboard/carriers?${param}=${encodeURIComponent(lookupValue.trim())}`);
  };

  const followUpCountdown = stats?.closestFollowUp?.scheduledAt
    ? formatCountdown(new Date(stats.closestFollowUp.scheduledAt).getTime() - now)
    : null;

  const followUpReady = stats?.closestFollowUp?.scheduledAt
    ? new Date(stats.closestFollowUp.scheduledAt).getTime() <= now
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-2 text-sm text-gray-400">
          A quick look at your inbox activity and sending history.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Emails Sent */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
        >
          <p className="text-sm text-gray-400">Emails Sent</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">
            {stats?.emailsSent ?? "—"}
          </h2>
          <p className="mt-2 text-sm text-gray-300">Last 30 days</p>

          <div className="mt-5 h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
              style={{ width: `${Math.min(100, ((stats?.emailsSent ?? 0) / 200) * 100)}%` }}
            />
          </div>
        </motion.div>

        {/* New Emails */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          onClick={() => router.push("/dashboard/inbox?tab=inbox")}
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 to-green-500/10 p-6 text-left backdrop-blur-xl transition hover:border-emerald-400/40"
        >
          <p className="text-sm text-gray-400">New Emails</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">
            {stats?.newEmails ?? "—"}
          </h2>
          <p className="mt-2 text-sm text-gray-300">Unread in your inbox</p>

          <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80">
            Open inbox
          </div>
        </motion.button>

        {/* Follow Ups */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          onClick={() => router.push("/dashboard/inbox?tab=followUp")}
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 to-yellow-500/10 p-6 text-left backdrop-blur-xl transition hover:border-amber-400/40"
        >
          <p className="text-sm text-gray-400">Follow Ups</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">
            {stats?.followUpCount ?? "—"}
          </h2>

          {stats?.closestFollowUp && (
            <div className="mt-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  followUpReady
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {followUpCountdown}
              </span>
              <p className="mt-1 text-xs text-gray-400 truncate">
                Next: {stats.closestFollowUp.subject}
              </p>
            </div>
          )}

          {!stats?.closestFollowUp && stats?.followUpCount === 0 && (
            <p className="mt-2 text-sm text-gray-300">No follow-ups scheduled</p>
          )}

          <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80">
            View follow-ups
          </div>
        </motion.button>
      </div>

      {/* Carrier Lookup */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
      >
        <p className="text-sm text-gray-400">Quick Lookup</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Carrier Lookup</h2>
        <p className="mt-2 text-sm text-gray-300">
          Look up a carrier by DOT or MC number to view their FMCSA profile and risk assessment.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* DOT / MC Toggle */}
          <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
            <button
              onClick={() => setLookupType("DOT")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                lookupType === "DOT"
                  ? "bg-white/15 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              DOT
            </button>
            <button
              onClick={() => setLookupType("MC")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                lookupType === "MC"
                  ? "bg-white/15 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              MC
            </button>
          </div>

          {/* Input */}
          <input
            type="text"
            value={lookupValue}
            onChange={(e) => setLookupValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCarrierLookup()}
            placeholder={lookupType === "DOT" ? "Enter DOT number..." : "Enter MC number..."}
            className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
          />

          {/* Lookup Button */}
          <button
            onClick={handleCarrierLookup}
            disabled={!lookupValue.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lookup
          </button>
        </div>
      </motion.div>
    </div>
  );
}