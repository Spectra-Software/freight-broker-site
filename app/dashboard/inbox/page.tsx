"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Attachment = {
  id?: string;
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
};

type EmailItem = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  body?: string;
  time?: string;
  sentAt?: string;
  scheduledAt?: string;
  status?: "INBOX" | "SENT" | "FOR_APPROVAL" | "FOLLOW_UP";
  attachments?: Attachment[];
  to?: string;
};

type TabKey = "inbox" | "sent" | "approval" | "followUp";

const tabs: { key: TabKey; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "approval", label: "For Approval" },
  { key: "followUp", label: "Follow Up" },
];

async function fetchMessages(endpoint: string): Promise<EmailItem[]> {
  try {
    const res = await fetch(endpoint);

    if (!res.ok) return [];

    const data: { messages?: EmailItem[]; items?: EmailItem[] } = await res.json();
    return (data.messages || data.items || []) as EmailItem[];
  } catch {
    return [];
  }
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isThisYear) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitial(name?: string) {
  if (!name) return "?";
  const cleaned = name.replace(/[<>"]/g, "").trim();
  const match = cleaned.match(/^(.+?)\s*<|^"?(.+?)"?\s*<|^(\S+)/);
  if (match) {
    const part = (match[1] || match[2] || match[3]).trim();
    return part[0].toUpperCase();
  }
  return cleaned[0].toUpperCase();
}

function extractName(from?: string) {
  if (!from) return "Unknown";
  const match = from.match(/^"?(.+?)"?\s*<|^([^<]+)/);
  if (match) return (match[1] || match[2]).trim();
  return from.trim();
}

function extractEmail(from?: string) {
  if (!from) return "";
  const match = from.match(/<(.+?)>/);
  if (match) return match[1].trim();
  return from.trim();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready to send";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function CountdownBadge({ scheduledAt }: { scheduledAt: string | null | undefined }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!scheduledAt) return null;
  const target = new Date(scheduledAt).getTime();
  const remaining = target - now;
  const ready = remaining <= 0;

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      ready ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
    }`}>
      {formatCountdown(remaining)}
    </span>
  );
}

function getTabFromSearch(value: string | null): TabKey {
  if (value === "sent") return "sent";
  if (value === "approval") return "approval";
  if (value === "followUp") return "followUp";
  return "inbox";
}

export default function InboxPage() {
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    getTabFromSearch(searchParams.get("tab"))
  );

  const [inboxEmails, setInboxEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [approvalEmails, setApprovalEmails] = useState<EmailItem[]>([]);
  const [followUpEmails, setFollowUpEmails] = useState<EmailItem[]>([]);

  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);
  const [selectedFollowUpIds, setSelectedFollowUpIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setActiveTab(getTabFromSearch(searchParams.get("tab")));
  }, [searchParams]);

  const activeItems = useMemo(() => {
    switch (activeTab) {
      case "inbox":
        return inboxEmails;
      case "sent":
        return sentEmails;
      case "approval":
        return approvalEmails;
      case "followUp":
        return followUpEmails;
      default:
        return [];
    }
  }, [activeTab, inboxEmails, sentEmails, approvalEmails, followUpEmails]);

  const refreshTab = async (tab?: TabKey) => {
    const targets = tab ? [tab] : (["inbox", "sent", "approval", "followUp"] as TabKey[]);
    setRefreshing(true);

    const endpointMap: Record<TabKey, string> = {
      inbox: "/api/gmail/inbox",
      sent: "/api/gmail/sent",
      approval: "/api/gmail/for-approval",
      followUp: "/api/gmail/follow-ups",
    };
    const setterMap: Record<TabKey, React.Dispatch<React.SetStateAction<EmailItem[]>>> = {
      inbox: setInboxEmails,
      sent: setSentEmails,
      approval: setApprovalEmails,
      followUp: setFollowUpEmails,
    };

    await Promise.all(
      targets.map(async (t) => {
        const items = await fetchMessages(endpointMap[t]);
        setterMap[t](items);
      })
    );

    setRefreshing(false);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [inbox, sent, approval, followUp] = await Promise.all([
        fetchMessages("/api/gmail/inbox"),
        fetchMessages("/api/gmail/sent"),
        fetchMessages("/api/gmail/for-approval"),
        fetchMessages("/api/gmail/follow-ups"),
      ]);

      setInboxEmails(inbox);
      setSentEmails(sent);
      setApprovalEmails(approval);
      setFollowUpEmails(followUp);

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    if (activeTab !== "approval") return;

    const interval = setInterval(async () => {
      const approval = await fetchMessages("/api/gmail/for-approval");
      setApprovalEmails(approval);
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "followUp") return;

    const interval = setInterval(async () => {
      const followUp = await fetchMessages("/api/gmail/follow-ups");
      setFollowUpEmails(followUp);
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    setSelectedApprovalIds([]);
    setSelectedFollowUpIds([]);
    setSelectedEmail(activeItems[0] || null);
  }, [activeTab]);

  const handleDeleteSelected = async () => {
    if (!selectedApprovalIds.length) return;

    try {
      const res = await fetch("/api/gmail/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedApprovalIds }),
      });

      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete drafts");

      setApprovalEmails((prev) => prev.filter((e) => !selectedApprovalIds.includes(e.id)));
      setSelectedApprovalIds([]);
      setSelectedEmail(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSingle = async (id?: string) => {
    if (!id) return;
    try {
      const res = await fetch("/api/gmail/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete draft");

      setApprovalEmails((prev) => prev.filter((e) => e.id !== id));
      if (selectedEmail?.id === id) setSelectedEmail(null);
      setSelectedApprovalIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const approvalSelectedCount = selectedApprovalIds.length;
  const approvalAllSelected =
    approvalEmails.length > 0 && selectedApprovalIds.length === approvalEmails.length;

  const toggleApprovalItem = (id: string) => {
    setSelectedApprovalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllApproval = () => {
    if (approvalAllSelected) {
      setSelectedApprovalIds([]);
      return;
    }

    setSelectedApprovalIds(approvalEmails.map((x) => x.id));
  };

  const handleSendSelected = async () => {
    if (!selectedApprovalIds.length) return;

    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: selectedApprovalIds }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to send emails");

      setApprovalEmails((prev) => prev.filter((e) => !selectedApprovalIds.includes(e.id)));
      setSelectedApprovalIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const followUpSelectedCount = selectedFollowUpIds.length;
  const followUpAllSelected = followUpEmails.length > 0 && selectedFollowUpIds.length === followUpEmails.length;

  const isFollowUpReady = (email: EmailItem) => {
    if (!email.scheduledAt) return false;
    return new Date(email.scheduledAt).getTime() <= Date.now();
  };

  const toggleFollowUpItem = (id: string) => {
    setSelectedFollowUpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFollowUps = () => {
    if (followUpAllSelected) {
      setSelectedFollowUpIds([]);
      return;
    }
    setSelectedFollowUpIds(followUpEmails.filter(isFollowUpReady).map((x) => x.id));
  };

  const handleSendFollowUps = useCallback(async () => {
    if (!selectedFollowUpIds.length) return;

    try {
      const res = await fetch("/api/gmail/send-follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedFollowUpIds }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to send follow-ups");

      setFollowUpEmails((prev) => prev.filter((e) => !selectedFollowUpIds.includes(e.id)));
      setSelectedFollowUpIds([]);
      setSelectedEmail(null);
    } catch (err) {
      console.error(err);
    }
  }, [selectedFollowUpIds]);

  const handleDeleteFollowUp = async (id?: string) => {
    if (!id) return;
    try {
      const res = await fetch("/api/gmail/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete follow-up");

      setFollowUpEmails((prev) => prev.filter((e) => e.id !== id));
      if (selectedEmail?.id === id) setSelectedEmail(null);
      setSelectedFollowUpIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const showApprovalActions = activeTab === "approval";
  const showFollowUpActions = activeTab === "followUp";

  const getAvatarColor = (name: string) => {
    const colors = [
      "from-indigo-500/30 to-indigo-600/20 text-indigo-300",
      "from-cyan-500/30 to-cyan-600/20 text-cyan-300",
      "from-violet-500/30 to-violet-600/20 text-violet-300",
      "from-emerald-500/30 to-emerald-600/20 text-emerald-300",
      "from-amber-500/30 to-amber-600/20 text-amber-300",
      "from-rose-500/30 to-rose-600/20 text-rose-300",
      "from-teal-500/30 to-teal-600/20 text-teal-300",
      "from-pink-500/30 to-pink-600/20 text-pink-300",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* GMAIL-STYLE TOOLBAR */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-0">
        <div className="flex items-center gap-3">
          {/* Refresh */}
          {(activeTab === "inbox" || activeTab === "sent") && (
            <button
              onClick={() => refreshTab(activeTab)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition disabled:opacity-40"
            >
              <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          )}

          {/* Approval actions */}
          {showApprovalActions && (
            <>
              <button
                onClick={toggleSelectAllApproval}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {approvalAllSelected ? "Deselect All" : "Select All"}
              </button>

              <button
                onClick={handleSendSelected}
                disabled={!approvalSelectedCount}
                className="flex items-center gap-2 rounded-lg bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 text-sm text-indigo-300 hover:bg-indigo-500/30 transition disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Send ({approvalSelectedCount})
              </button>

              <button
                onClick={handleDeleteSelected}
                disabled={!approvalSelectedCount}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-rose-500/10 hover:text-rose-300 transition disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete ({approvalSelectedCount})
              </button>
            </>
          )}

          {/* Follow-up actions */}
          {showFollowUpActions && (
            <>
              <button
                onClick={toggleSelectAllFollowUps}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {followUpAllSelected ? "Deselect All" : "Select Ready"}
              </button>

              <button
                onClick={handleSendFollowUps}
                disabled={!followUpSelectedCount}
                className="flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Send Follow-Up ({followUpSelectedCount})
              </button>
            </>
          )}
        </div>

        {/* Email count */}
        <span className="text-xs text-gray-500">
          {activeItems.length} message{activeItems.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* GMAIL-STYLE TABS */}
      <div className="flex items-center gap-0 border-b border-white/[0.06]">
        {tabs.map((tab) => {
          const count =
            tab.key === "inbox"
              ? inboxEmails.length
              : tab.key === "sent"
              ? sentEmails.length
              : tab.key === "approval"
              ? approvalEmails.length
              : followUpEmails.length;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "text-indigo-300"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-indigo-500" />
              )}
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${isActive ? "text-indigo-400" : "text-gray-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* EMAIL LIST */}
        <div className="w-[380px] min-w-[380px] overflow-y-auto border-r border-white/[0.06]">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <div className="h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2" />
              Loading...
            </div>
          )}

          {!loading && activeItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              No messages
            </div>
          )}

          {activeItems.map((email: EmailItem) => {
            const isSelected = selectedEmail?.id === email.id;
            const sender = extractName(email.from || email.to);
            const initial = getInitial(email.from || email.to);
            const avatarColor = getAvatarColor(sender);
            const dateStr = formatDate(email.time || email.sentAt || email.scheduledAt);

            return (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-white/[0.04] transition ${
                  isSelected
                    ? "bg-indigo-500/[0.08] border-l-2 border-l-indigo-500"
                    : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
                }`}
              >
                {/* Checkbox for approval/follow-up */}
                {(activeTab === "approval" || (activeTab === "followUp" && isFollowUpReady(email))) && (
                  <input
                    type="checkbox"
                    checked={
                      activeTab === "approval"
                        ? selectedApprovalIds.includes(email.id)
                        : selectedFollowUpIds.includes(email.id)
                    }
                    onChange={() => {
                      if (activeTab === "approval") toggleApprovalItem(email.id);
                      else toggleFollowUpItem(email.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-indigo-500 flex-shrink-0"
                  />
                )}

                {/* Avatar */}
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold ${avatarColor}`}>
                  {initial}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${isSelected ? "font-semibold text-white" : "font-medium text-gray-200"}`}>
                      {sender}
                    </p>
                    <span className="flex-shrink-0 text-xs text-gray-500">{dateStr}</span>
                  </div>
                  <p className={`mt-0.5 truncate text-sm ${isSelected ? "text-gray-200" : "text-gray-400"}`}>
                    {email.subject}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{email.snippet}</p>

                  {activeTab === "followUp" && (
                    <div className="mt-1.5">
                      <CountdownBadge scheduledAt={email.scheduledAt} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* EMAIL DETAIL */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!selectedEmail ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-16 h-16 mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <p className="text-sm">Select a message to read</p>
            </div>
          ) : (
            <>
              {/* Email header */}
              <div className="border-b border-white/[0.06] px-6 py-4">
                <h2 className="text-lg font-semibold text-white mb-3">
                  {selectedEmail.subject}
                </h2>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold ${getAvatarColor(extractName(selectedEmail.from || selectedEmail.to))}`}>
                    {getInitial(selectedEmail.from || selectedEmail.to)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-white">
                        {extractName(selectedEmail.from || selectedEmail.to)}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        &lt;{extractEmail(selectedEmail.from || selectedEmail.to)}&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {selectedEmail.from ? "to me" : selectedEmail.to ? `to ${extractName(selectedEmail.to)}` : ""}
                      </span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">
                        {formatFullDate(selectedEmail.time || selectedEmail.sentAt || selectedEmail.scheduledAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email body */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
                <div
                  className="email-body text-sm text-gray-300 leading-relaxed max-w-none overflow-hidden break-words [&_a]:text-indigo-400 [&_a]:underline [&_a:hover]:text-indigo-300 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_table]:max-w-full [&_table]:overflow-hidden [&_table]:block [&_td]:break-words [&_th]:break-words [&_div]:max-w-full [&_div]:overflow-hidden [&_span]:break-words [&_p]:mb-3 [&_p]:break-words [&_ul]:mb-3 [&_ol]:mb-3 [&_li]:mb-1 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-base [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500/30 [&_blockquote]:pl-4 [&_blockquote]:text-gray-400 [&_pre]:overflow-x-auto [&_pre]:max-w-full"
                  dangerouslySetInnerHTML={{
                    __html: selectedEmail.body || (selectedEmail.snippet ? `<p>${selectedEmail.snippet}</p>` : "<p>No content available.</p>"),
                  }}
                />

                {selectedEmail.attachments?.length ? (
                  <div className="mt-6 pt-4 border-t border-white/[0.06]">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                      {selectedEmail.attachments.length} attachment{selectedEmail.attachments.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((file: Attachment) => (
                        <a
                          key={file.name}
                          href={file.url || "#"}
                          target={file.url ? "_blank" : undefined}
                          rel={file.url ? "noreferrer" : undefined}
                          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white transition"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === "followUp" && selectedEmail.scheduledAt ? (
                  <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-3">
                    <CountdownBadge scheduledAt={selectedEmail.scheduledAt} />
                    <span className="text-xs text-gray-500">
                      Scheduled: {formatFullDate(selectedEmail.scheduledAt)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-2 border-t border-white/[0.06] px-6 py-3">
                <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                  Reply
                </button>

                <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  Forward
                </button>

                {activeTab === "approval" && (
                  <button
                    onClick={handleSendSelected}
                    disabled={!selectedApprovalIds.includes(selectedEmail.id) && !approvalSelectedCount}
                    className="flex items-center gap-2 rounded-lg bg-indigo-500/20 border border-indigo-500/20 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-500/30 transition disabled:opacity-40"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    Send Draft
                  </button>
                )}

                {activeTab === "approval" && (
                  <button
                    onClick={() => handleDeleteSingle(selectedEmail?.id)}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete Draft
                  </button>
                )}

                {activeTab === "followUp" && isFollowUpReady(selectedEmail) && (
                  <button
                    onClick={handleSendFollowUps}
                    disabled={!selectedFollowUpIds.includes(selectedEmail.id)}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-40"
                  >
                    {selectedFollowUpIds.includes(selectedEmail.id) ? "Send Follow-Up" : "Select to Send"}
                  </button>
                )}

                {activeTab === "followUp" && !isFollowUpReady(selectedEmail) && (
                  <button
                    disabled
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-600 cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Scheduled
                  </button>
                )}

                {activeTab === "followUp" && (
                  <button
                    onClick={() => handleDeleteFollowUp(selectedEmail?.id)}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}