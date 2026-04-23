"use client";

import { useEffect, useState, useCallback } from "react";

type LeadStatus = "COLD" | "WARM" | "ONBOARDED" | "DRAFT_CREATED" | "DRAFT_SENT";

interface Lead {
  id: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  commodity: string | null;
  status: LeadStatus;
  lastCalledAt: string | null;
  callbackAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  COLD: { label: "Cold", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  WARM: { label: "Warm", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  ONBOARDED: { label: "Onboarded", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  DRAFT_CREATED: { label: "Draft Created", color: "text-cyan-400", bg: "bg-cyan-500/15 border-cyan-500/30" },
  DRAFT_SENT: { label: "Draft Sent", color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" },
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const emptyForm = {
  company: "",
  contactName: "",
  phone: "",
  email: "",
  commodity: "",
  status: "COLD" as LeadStatus,
  lastCalledAt: "",
  callbackAt: "",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | "ALL" | "PROSPECTS">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(Array.isArray(data.leads) ? data.leads : []);
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Auto-populate callback date 14 days from last called date
  useEffect(() => {
    if (form.lastCalledAt) {
      setForm((prev) => ({ ...prev, callbackAt: addDays(form.lastCalledAt, 14) }));
    }
  }, [form.lastCalledAt]);

  const filtered = filter === "PROSPECTS"
    ? [...leads].sort((a, b) => {
        // No-email prospects first, then DRAFT_CREATED, then DRAFT_SENT
        const rank = (l: Lead) => !l.email ? 0 : l.status === "DRAFT_CREATED" ? 1 : l.status === "DRAFT_SENT" ? 2 : 3;
        return rank(a) - rank(b);
      }).filter((l) => !l.email || l.status === "DRAFT_CREATED" || l.status === "DRAFT_SENT")
    : filter === "ALL" ? leads : leads.filter((l) => l.status === filter);

  const counts = {
    ALL: leads.length,
    COLD: leads.filter((l) => l.status === "COLD").length,
    WARM: leads.filter((l) => l.status === "WARM").length,
    ONBOARDED: leads.filter((l) => l.status === "ONBOARDED").length,
    DRAFT_CREATED: leads.filter((l) => l.status === "DRAFT_CREATED").length,
    DRAFT_SENT: leads.filter((l) => l.status === "DRAFT_SENT").length,
    PROSPECTS: leads.filter((l) => !l.email || l.status === "DRAFT_CREATED" || l.status === "DRAFT_SENT").length,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) return;
    setSaving(true);

    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        company: form.company,
        contactName: form.contactName || null,
        phone: form.phone || null,
        email: form.email || null,
        commodity: form.commodity || null,
        status: form.status,
        lastCalledAt: form.lastCalledAt || null,
        callbackAt: form.callbackAt || null,
      };

      const res = await fetch("/api/leads", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchLeads();
        resetForm();
      } else {
        const data = await res.json();
        console.error("Save failed:", data.error);
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(lead: Lead) {
    setEditingId(lead.id);
    setForm({
      company: lead.company,
      contactName: lead.contactName || "",
      phone: lead.phone || "",
      email: lead.email || "",
      commodity: lead.commodity || "",
      status: lead.status,
      lastCalledAt: lead.lastCalledAt ? lead.lastCalledAt.split("T")[0] : "",
      callbackAt: lead.callbackAt ? lead.callbackAt.split("T")[0] : "",
    });
    setShowForm(true);
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
      if (res.ok) setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="animate-pulse text-gray-400">Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-sm text-gray-400 mt-1">Track potential clients through your sales pipeline</p>
        </div>
        <button
          onClick={() => {
            if (showForm && !editingId) { resetForm(); return; }
            resetForm();
            setShowForm(true);
          }}
          className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600"
        >
          {showForm && !editingId ? "Cancel" : "+ Add Lead"}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editingId ? "Edit Lead" : "New Lead"}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Company Name *</label>
              <input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Acme Logistics"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Contact Name</label>
              <input
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Phone Number</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="john@acme.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Commodity</label>
              <input
                value={form.commodity}
                onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Dry goods, Refrigerated..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LeadStatus }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="COLD">Cold</option>
                <option value="WARM">Warm</option>
                <option value="DRAFT_CREATED">Draft Created</option>
                <option value="DRAFT_SENT">Draft Sent</option>
                <option value="ONBOARDED">Onboarded</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Last Called Date</label>
              <input
                type="date"
                value={form.lastCalledAt}
                onChange={(e) => setForm((f) => ({ ...f, lastCalledAt: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Callback Date <span className="text-gray-500">(auto +14 days)</span></label>
              <input
                type="date"
                value={form.callbackAt}
                onChange={(e) => setForm((f) => ({ ...f, callbackAt: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !form.company.trim()}
              className="rounded-xl bg-blue-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update Lead" : "Add Lead"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-white/10 px-5 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["ALL", "COLD", "WARM", "DRAFT_CREATED", "DRAFT_SENT", "ONBOARDED", "PROSPECTS"] as const).map((s) => {
          const cfg = s === "ALL" ? { label: "All", color: "text-gray-300", bg: "bg-white/10 border-white/10" } : s === "PROSPECTS" ? { label: "Prospects", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" } : STATUS_CONFIG[s];
          const isActive = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                isActive ? `${cfg.bg} ${cfg.color}` : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {cfg.label} ({counts[s]})
            </button>
          );
        })}
      </div>

      {/* Leads Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
          <p className="text-gray-400">No leads found</p>
          <p className="mt-1 text-sm text-gray-500">Click &quot;+ Add Lead&quot; to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-medium text-gray-400">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Commodity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Called</th>
                <th className="px-4 py-3">Callback</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const cfg = STATUS_CONFIG[lead.status];
                const isOverdue = lead.callbackAt && new Date(lead.callbackAt) < new Date();
                return (
                  <tr key={lead.id} className="border-b border-white/5 transition hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{lead.company}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.contactName || "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.phone || "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.email || "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.commodity || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) => {
                          const next = e.target.value as LeadStatus;
                          fetch("/api/leads", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: lead.id, status: next }),
                          }).then(async (res) => {
                            if (res.ok) {
                              const data = await res.json();
                              setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
                            }
                          });
                        }}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium outline-none ${cfg.bg} ${cfg.color} cursor-pointer appearance-none text-center`}
                      >
                        <option value="COLD">Cold</option>
                        <option value="WARM">Warm</option>
                        <option value="DRAFT_CREATED">Draft Created</option>
                        <option value="DRAFT_SENT">Draft Sent</option>
                        <option value="ONBOARDED">Onboarded</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{formatDate(lead.lastCalledAt)}</td>
                    <td className="px-4 py-3">
                      <span className={isOverdue ? "text-red-400 font-medium" : "text-gray-300"}>
                        {formatDate(lead.callbackAt)}
                      </span>
                      {isOverdue && <span className="ml-1 text-xs text-red-400">⚠ overdue</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(lead)}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteLead(lead.id)}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 0-2 2-2h4c2 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
