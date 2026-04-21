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

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  company: string | null;
  phone: string | null;
  role: string;
  status: string;
  plan: string;
  isOnboarded: boolean;
  createdAt: string;
  _count: {
    emails: number;
    applications: number;
  };
};

type UserDetail = {
  user: AdminUser;
  emails: {
    id: string;
    type: string;
    status: string;
    to: string;
    from: string | null;
    subject: string;
    body: string;
    snippet: string | null;
    company: string | null;
    scheduledAt: string | null;
    sentAt: string | null;
    createdAt: string;
  }[];
  applications: {
    id: string;
    name: string;
    company: string;
    email: string;
    comments: string | null;
    desiredPlan: string;
    status: string;
    createdAt: string;
  }[];
};

type ViewMode = "applications" | "users";
type Filter = "PENDING" | "APPROVED" | "DENIED";
type UserFilter = "ACTIVE" | "SUSPENDED" | "BANNED" | "ALL";

export default function AdminPage() {
  const router = useRouter();

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");

  const [view, setView] = useState<ViewMode>("applications");
  const [filter, setFilter] = useState<Filter>("PENDING");

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userFilter, setUserFilter] = useState<UserFilter>("ALL");

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Action state
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

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

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (view === "users") loadUsers();
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

  async function updateUserStatus(userId: string, newStatus: "ACTIVE" | "SUSPENDED" | "BANNED") {
    setStatusUpdating(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });

      if (res.ok) {
        await loadUsers();
        // Also refresh detail if viewing this user
        if (selectedUser?.user.id === userId) {
          await loadUserDetail(userId);
        }
      }
    } finally {
      setStatusUpdating(null);
    }
  }

  async function loadUserDetail(userId: string) {
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data);
      }
    } finally {
      setDetailLoading(false);
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

  const filteredUsers = useMemo(() => {
    if (userFilter === "ALL") return users;
    return users.filter((u) => u.status === userFilter);
  }, [users, userFilter]);

  const userStats = useMemo(() => {
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const suspended = users.filter((u) => u.status === "SUSPENDED").length;
    const banned = users.filter((u) => u.status === "BANNED").length;
    return { active, suspended, banned, total: users.length };
  }, [users]);

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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: "bg-green-500/20 text-green-400",
      SUSPENDED: "bg-yellow-500/20 text-yellow-400",
      BANNED: "bg-red-500/20 text-red-400",
    };
    return map[status] || "bg-white/10 text-gray-400";
  };

  const planBadge = (plan: string) => {
    const map: Record<string, string> = {
      BASIC: "bg-blue-500/20 text-blue-400",
      MID: "bg-purple-500/20 text-purple-400",
      PREMIUM: "bg-amber-500/20 text-amber-400",
    };
    return map[plan] || "bg-white/10 text-gray-400";
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-black to-slate-900 text-white">
      <AnimatedBackground />

      <div className="relative z-10 flex w-full">
        {/* SIDEBAR */}
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

              <button onClick={() => setView("users")} className={`w-full rounded-xl px-4 py-3 text-left font-semibold ${view === "users" ? "bg-blue-500 text-white" : "text-gray-300 hover:bg-white/10"}`}>
                Users
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

            {view === "users" && (
              <div className="flex gap-2">
                <button onClick={() => setUserFilter("ALL")} className={`rounded-xl px-4 py-2 text-sm ${userFilter === "ALL" ? "bg-blue-500 text-white" : "bg-white/5 text-gray-300"}`}>
                  All ({userStats.total})
                </button>
                <button onClick={() => setUserFilter("ACTIVE")} className={`rounded-xl px-4 py-2 text-sm ${userFilter === "ACTIVE" ? "bg-green-500 text-white" : "bg-white/5 text-gray-300"}`}>
                  Active ({userStats.active})
                </button>
                <button onClick={() => setUserFilter("SUSPENDED")} className={`rounded-xl px-4 py-2 text-sm ${userFilter === "SUSPENDED" ? "bg-yellow-500 text-white" : "bg-white/5 text-gray-300"}`}>
                  Suspended ({userStats.suspended})
                </button>
                <button onClick={() => setUserFilter("BANNED")} className={`rounded-xl px-4 py-2 text-sm ${userFilter === "BANNED" ? "bg-red-500 text-white" : "bg-white/5 text-gray-300"}`}>
                  Banned ({userStats.banned})
                </button>
              </div>
            )}
          </header>

          <main className="space-y-6 p-6">

            {/* APPLICATIONS VIEW */}
            {view === "applications" && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">

                {loading ? (
                  <p className="text-gray-400">Loading...</p>
                ) : filteredApps.length === 0 ? (
                  <p className="text-gray-400">No {filter.toLowerCase()} applications.</p>
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

            {/* USERS VIEW */}
            {view === "users" && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                {usersLoading ? (
                  <p className="text-gray-400">Loading users...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-gray-400">No users found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400">
                          <th className="pb-3 pr-4 font-medium">User</th>
                          <th className="pb-3 pr-4 font-medium">Company</th>
                          <th className="pb-3 pr-4 font-medium">Plan</th>
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 pr-4 font-medium">Emails</th>
                          <th className="pb-3 pr-4 font-medium">Joined</th>
                          <th className="pb-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="group hover:bg-white/5 transition">
                            <td className="py-3 pr-4">
                              <div>
                                <p className="font-semibold text-white">{u.name || "—"}</p>
                                <p className="text-xs text-gray-400">{u.email}</p>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-gray-300">{u.company || "—"}</td>
                            <td className="py-3 pr-4">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${planBadge(u.plan)}`}>
                                {u.plan}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(u.status)}`}>
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-300">{u._count.emails}</td>
                            <td className="py-3 pr-4 text-gray-400 text-xs">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => loadUserDetail(u.id)}
                                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                                >
                                  View
                                </button>
                                {u.status === "ACTIVE" && (
                                  <>
                                    <button
                                      onClick={() => updateUserStatus(u.id, "SUSPENDED")}
                                      disabled={statusUpdating === u.id}
                                      className="rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
                                    >
                                      Suspend
                                    </button>
                                    <button
                                      onClick={() => updateUserStatus(u.id, "BANNED")}
                                      disabled={statusUpdating === u.id}
                                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                                    >
                                      Ban
                                    </button>
                                  </>
                                )}
                                {u.status === "SUSPENDED" && (
                                  <>
                                    <button
                                      onClick={() => updateUserStatus(u.id, "ACTIVE")}
                                      disabled={statusUpdating === u.id}
                                      className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                                    >
                                      Reactivate
                                    </button>
                                    <button
                                      onClick={() => updateUserStatus(u.id, "BANNED")}
                                      disabled={statusUpdating === u.id}
                                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                                    >
                                      Ban
                                    </button>
                                  </>
                                )}
                                {u.status === "BANNED" && (
                                  <button
                                    onClick={() => updateUserStatus(u.id, "ACTIVE")}
                                    disabled={statusUpdating === u.id}
                                    className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                                  >
                                    Unban
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>

      {/* USER DETAIL MODAL */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDetail(false)}>
          <div className="relative max-h-[80vh] w-[700px] overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6" onClick={(e) => e.stopPropagation()}>

            {detailLoading ? (
              <p className="text-gray-400">Loading user details...</p>
            ) : selectedUser ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedUser.user.name || "—"}</h2>
                    <p className="text-sm text-gray-400">{selectedUser.user.email}</p>
                  </div>
                  <button onClick={() => setShowDetail(false)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
                    Close
                  </button>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-gray-400">Company</p>
                    <p className="text-sm text-white">{selectedUser.user.company || "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm text-white">{selectedUser.user.phone || "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-gray-400">Plan</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${planBadge(selectedUser.user.plan)}`}>
                      {selectedUser.user.plan}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-gray-400">Status</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(selectedUser.user.status)}`}>
                      {selectedUser.user.status}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-gray-400">Role</p>
                    <p className="text-sm text-white">{selectedUser.user.role}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-gray-400">Joined</p>
                    <p className="text-sm text-white">{new Date(selectedUser.user.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Moderation Actions */}
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-400 mb-3">Moderation Actions</p>
                  <div className="flex gap-2">
                    {selectedUser.user.status !== "ACTIVE" && (
                      <button
                        onClick={() => updateUserStatus(selectedUser.user.id, "ACTIVE")}
                        disabled={statusUpdating === selectedUser.user.id}
                        className="rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )}
                    {selectedUser.user.status !== "SUSPENDED" && (
                      <button
                        onClick={() => updateUserStatus(selectedUser.user.id, "SUSPENDED")}
                        disabled={statusUpdating === selectedUser.user.id}
                        className="rounded-xl bg-yellow-500/20 px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    )}
                    {selectedUser.user.status !== "BANNED" && (
                      <button
                        onClick={() => updateUserStatus(selectedUser.user.id, "BANNED")}
                        disabled={statusUpdating === selectedUser.user.id}
                        className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        Ban
                      </button>
                    )}
                  </div>
                </div>

                {/* Email Activity (Chat Logs) */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Email Activity ({selectedUser.emails.length})</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedUser.emails.length === 0 ? (
                      <p className="text-sm text-gray-400">No email activity.</p>
                    ) : (
                      selectedUser.emails.map((email) => (
                        <div key={email.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-white truncate max-w-[400px]">{email.subject}</p>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                email.status === "SENT" ? "bg-green-500/20 text-green-400" :
                                email.status === "DRAFT" ? "bg-blue-500/20 text-blue-400" :
                                email.status === "FOLLOW_UP" ? "bg-yellow-500/20 text-yellow-400" :
                                email.status === "FAILED" ? "bg-red-500/20 text-red-400" :
                                "bg-white/10 text-gray-400"
                              }`}>
                                {email.status}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {new Date(email.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            To: {email.to} {email.company && `· ${email.company}`}
                          </p>
                          {email.snippet && (
                            <p className="text-xs text-gray-500 mt-1 truncate">{email.snippet}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Applications */}
                {selectedUser.applications.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Applications ({selectedUser.applications.length})</h3>
                    <div className="space-y-2">
                      {selectedUser.applications.map((app) => (
                        <div key={app.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-white">{app.name} · {app.company}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              app.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                              app.status === "DENIED" ? "bg-red-500/20 text-red-400" :
                              "bg-yellow-500/20 text-yellow-400"
                            }`}>
                              {app.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Plan: {app.desiredPlan} · {new Date(app.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}