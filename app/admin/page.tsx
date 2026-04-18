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

type ViewMode = "applications" | "inbox" | "sent";
type Filter = "PENDING" | "APPROVED" | "DENIED";

export default function AdminPage() {
  const router = useRouter();

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");

  const [view, setView] = useState<ViewMode>("applications");
  const [filter, setFilter] = useState<Filter>("PENDING");

  // Gmail state
  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [mailLoading, setMailLoading] = useState(false);

  // ✅ RESEND STATE (NEW)
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  async function loadApps() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      setApps(data.apps || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApps();
  }, []);

  async function loadMail(type: ViewMode) {
    setMailLoading(true);
    try {
      if (type === "inbox") {
        const res = await fetch("/api/gmail/inbox");
        const data = await res.json();
        setInbox(data.inbox || data.messages || []);
      }

      if (type === "sent") {
        const res = await fetch("/api/gmail/sent");
        const data = await res.json();
        setSent(data.sent || data.messages || []);
      }
    } finally {
      setMailLoading(false);
    }
  }

  useEffect(() => {
    if (view === "inbox" || view === "sent") {
      loadMail(view);
    }
  }, [view]);

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

  // ✅ RESEND WITH 30s COOLDOWN + SPINNER
  async function resendInvite(id: string) {
    if (resendingId === id || cooldowns[id]) return;

    setResendingId(id);

    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id }),
      });

      const data = await res.json();

      if (data.success) {
        setInviteLink(data.inviteLink);

        // start cooldown
        setCooldowns((prev) => ({ ...prev, [id]: 30 }));

        const interval = setInterval(() => {
          setCooldowns((prev) => {
            const current = prev[id];
            if (!current) {
              clearInterval(interval);
              return prev;
            }

            const next = current - 1;

            if (next <= 0) {
              const copy = { ...prev };
              delete copy[id];
              clearInterval(interval);
              return copy;
            }

            return { ...prev, [id]: next };
          });
        }, 1000);
      }
    } finally {
      setResendingId(null);
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

  const filteredApps = useMemo(() => {
    return apps.filter((a) => a.status === filter);
  }, [apps, filter]);

  function openGmailCompose(app: App) {
    const signature =
      "\n\n--\nBroker Buddy Freight OS\nAustin, TX\naustin@haulorafreight.com";

    const subject = `Broker Buddy Application - ${app.name}`;

    const body =
      `Hi ${app.name},\n\n` +
      `Thanks for applying to Broker Buddy.\n\n` +
      `We reviewed your application and wanted to reach out.\n\n` +
      `Company: ${app.company}\n` +
      `Plan: ${app.desiredPlan}\n\n` +
      `Comments:\n${app.comments}\n\n` +
      `We will be in touch shortly.\n` +
      signature;

    const gmailUrl =
      `https://mail.google.com/mail/?view=cm&fs=1` +
      `&to=${encodeURIComponent(app.email)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-black to-slate-900 text-white">
      <AnimatedBackground />

      <div className="relative z-10 flex w-full">

        {/* SIDEBAR unchanged */}
        <aside className="flex w-72 flex-col justify-between border-r border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div>
            <div className="mb-10">
              <p className="text-sm text-gray-400">Admin Console</p>
              <h1 className="text-2xl font-bold">Broker Buddy</h1>
            </div>

            <nav className="space-y-3">
              <button onClick={() => setView("applications")} className={`w-full rounded-xl px-4 py-3 text-left font-semibold ${view === "applications" ? "bg-blue-500 text-white" : "text-gray-300 hover:bg-white/10"}`}>
                Applications
              </button>

              <button onClick={() => setView("inbox")} className={`w-full rounded-xl px-4 py-3 text-left font-semibold ${view === "inbox" ? "bg-blue-500 text-white" : "text-gray-300 hover:bg-white/10"}`}>
                Inbox
              </button>

              <button onClick={() => setView("sent")} className={`w-full rounded-xl px-4 py-3 text-left font-semibold ${view === "sent" ? "bg-blue-500 text-white" : "text-gray-300 hover:bg-white/10"}`}>
                Sent
              </button>
            </nav>
          </div>

          <button onClick={() => router.push("/dashboard")} className="mt-10 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white hover:bg-white/10">
            Back to Dashboard
          </button>
        </aside>

        {/* MAIN */}
        <div className="flex-1 flex-col">

          <header className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
            <div>
              <p className="text-sm text-gray-400">Overview</p>
              <h2 className="text-xl font-semibold capitalize">{view}</h2>
            </div>

            {view === "applications" && (
              <div className="flex gap-2">
                <button onClick={() => setFilter("PENDING")} className={`rounded-xl px-4 py-2 text-sm ${filter === "PENDING" ? "bg-blue-500 text-white" : "bg-white/5 text-gray-300"}`}>
                  Pending ({stats.pending})
                </button>

                <button onClick={() => setFilter("APPROVED")} className={`rounded-xl px-4 py-2 text-sm ${filter === "APPROVED" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-300"}`}>
                  Approved ({stats.approved})
                </button>

                <button onClick={() => setFilter("DENIED")} className={`rounded-xl px-4 py-2 text-sm ${filter === "DENIED" ? "bg-red-500 text-white" : "bg-white/5 text-gray-300"}`}>
                  Denied ({stats.denied})
                </button>
              </div>
            )}
          </header>

          <main className="space-y-6 p-6">

            {view === "applications" && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">

                {loading ? (
                  <p className="text-gray-400">Loading...</p>
                ) : (
                  <div className="space-y-4">

                    {filteredApps.map((app) => (
                      <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-black/20 p-5">

                        <div className="flex justify-between gap-6">

                          <div onClick={() => openGmailCompose(app)} className="cursor-pointer">
                            <h4 className="text-lg font-semibold hover:text-blue-400">{app.name}</h4>
                            <p className="text-sm text-gray-300">{app.email} · {app.company}</p>
                          </div>

                          <div className="flex gap-2">

                            {app.status === "PENDING" && (
                              <>
                                <button onClick={() => approve(app.id)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold">
                                  Approve
                                </button>

                                <button onClick={() => deny(app.id)} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold">
                                  Deny
                                </button>
                              </>
                            )}

                            {app.status === "APPROVED" && (
                              <button
                                onClick={() => resendInvite(app.id)}
                                disabled={resendingId === app.id || !!cooldowns[app.id]}
                                className="rounded-xl px-4 py-2 text-sm font-semibold flex items-center justify-center min-w-[140px] bg-blue-500 disabled:opacity-70"
                              >
                                {resendingId === app.id ? (
                                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : cooldowns[app.id] ? (
                                  `Wait ${cooldowns[app.id]}s`
                                ) : (
                                  "Resend Invite"
                                )}
                              </button>
                            )}

                          </div>

                        </div>

                      </motion.div>
                    ))}

                  </div>
                )}

              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}