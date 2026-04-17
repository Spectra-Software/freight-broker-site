"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import AnimatedBackground from "@/components/AnimatedBackground";

type App = {
  id: string;
  name: string;
  email: string;
  company: string;
  comments: string;
  desiredPlan: "BASIC" | "MID" | "PREMIUM";
  status: "PENDING" | "APPROVED" | "DENIED";
  createdAt: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");

  async function loadApps() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/applications");
      const data = await res.json();
      setApps(data.apps || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApps();
  }, []);

  async function approve(id: string) {
    setActioningId(id);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id }),
      });

      const data = await res.json();

      if (data.success) {
        setInviteLink(data.inviteLink);
        await loadApps();
      }
    } finally {
      setActioningId(null);
    }
  }

  async function deny(id: string) {
    setActioningId(id);
    try {
      await fetch("/api/admin/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id }),
      });

      await loadApps();
    } finally {
      setActioningId(null);
    }
  }

  const stats = useMemo(() => {
    const pending = apps.filter((a) => a.status === "PENDING").length;
    const approved = apps.filter((a) => a.status === "APPROVED").length;
    const denied = apps.filter((a) => a.status === "DENIED").length;
    return { pending, approved, denied };
  }, [apps]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-black to-slate-900 text-white">
      <AnimatedBackground />

      <div className="relative z-10 flex w-full">
        <aside className="flex w-72 flex-col justify-between border-r border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div>
            <div className="mb-10">
              <p className="text-sm text-gray-400">Admin Console</p>
              <h1 className="text-2xl font-bold">Broker Buddy</h1>
            </div>

            <nav className="space-y-3">
              <button className="w-full rounded-xl bg-blue-500 px-4 py-3 text-left font-semibold text-white shadow-lg shadow-blue-500/20">
                Applications
              </button>
              <button className="w-full rounded-xl px-4 py-3 text-left text-gray-300 hover:bg-white/10">
                Invites
              </button>
              <button className="w-full rounded-xl px-4 py-3 text-left text-gray-300 hover:bg-white/10">
                Users
              </button>
            </nav>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-10 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white hover:bg-white/10"
          >
            Back to Dashboard
          </button>
        </aside>

        <div className="flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
            <div>
              <p className="text-sm text-gray-400">Overview</p>
              <h2 className="text-xl font-semibold">Admin Review Queue</h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
                {stats.pending} pending
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
                {stats.approved} approved
              </div>
            </div>
          </header>

          <main className="space-y-6 p-6">
            {inviteLink && (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <p className="text-sm text-emerald-300">Latest invite link</p>
                <p className="mt-2 break-all text-sm text-white/90">{inviteLink}</p>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <p className="text-sm text-gray-400">Pending</p>
                <h3 className="mt-2 text-3xl font-bold">{stats.pending}</h3>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <p className="text-sm text-gray-400">Approved</p>
                <h3 className="mt-2 text-3xl font-bold">{stats.approved}</h3>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <p className="text-sm text-gray-400">Denied</p>
                <h3 className="mt-2 text-3xl font-bold">{stats.denied}</h3>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Applications</p>
                  <h3 className="text-2xl font-semibold">Review queue</h3>
                </div>
              </div>

              {loading ? (
                <p className="text-gray-400">Loading applications...</p>
              ) : apps.length === 0 ? (
                <p className="text-gray-400">No applications yet.</p>
              ) : (
                <div className="space-y-4">
                  {apps.map((app, index) => (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="rounded-2xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-lg font-semibold">
                              {app.name}
                            </h4>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                              {app.status}
                            </span>
                          </div>

                          <p className="text-sm text-gray-300">
                            {app.email} · {app.company}
                          </p>

                          <p className="text-sm text-gray-400">
                            Plan: <span className="text-white">{app.desiredPlan}</span>
                          </p>

                          <p className="max-w-3xl text-sm leading-6 text-gray-400">
                            {app.comments}
                          </p>
                        </div>

                        <div className="flex gap-3">
                          {app.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => approve(app.id)}
                                disabled={actioningId === app.id}
                                className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                              >
                                {actioningId === app.id ? "Working..." : "Approve"}
                              </button>

                              <button
                                onClick={() => deny(app.id)}
                                disabled={actioningId === app.id}
                                className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                              >
                                Deny
                              </button>
                            </>
                          )}

                          {app.status !== "PENDING" && (
                            <button
                              onClick={() => approve(app.id)}
                              disabled={actioningId === app.id}
                              className="rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                            >
                              Reissue Invite
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}