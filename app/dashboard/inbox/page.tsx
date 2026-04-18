"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

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
  return d.toLocaleString();
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
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [inbox, sent, approval, followUp] = await Promise.all([
        fetchMessages("/api/gmail/inbox"),
        fetchMessages("/api/gmail/sent"),
        fetchMessages("/api/gmail/for-approval"),
        fetchMessages("/api/gmail/follow-up"),
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
    setSelectedApprovalIds([]);
    setSelectedEmail(activeItems[0] || null);
  }, [activeTab, activeItems]);

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

  const showApprovalActions = activeTab === "approval";

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {tabs.find((t) => t.key === activeTab)?.label}
          </h1>
          <p className="text-sm text-gray-400">
            Gmail, drafts, approvals, and follow-ups in one place
          </p>
        </div>

        {showApprovalActions && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleSelectAllApproval}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              {approvalAllSelected ? "Unselect All" : "Select All"}
            </button>

            <button
              onClick={handleSendSelected}
              disabled={!approvalSelectedCount}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send Selected ({approvalSelectedCount})
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              activeTab === tab.key
                ? "border-white bg-white text-black"
                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs opacity-70">
              {
                tab.key === "inbox"
                  ? inboxEmails.length
                  : tab.key === "sent"
                  ? sentEmails.length
                  : tab.key === "approval"
                  ? approvalEmails.length
                  : followUpEmails.length
              }
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-[380px] overflow-y-auto rounded-2xl border border-white/10 bg-white/5">
          {loading && <div className="p-4 text-sm text-gray-400">Loading...</div>}

          {!loading && activeItems.length === 0 && (
            <div className="p-4 text-sm text-gray-400">Nothing here yet.</div>
          )}

          {activeItems.map((email: EmailItem) => {
            const isSelected = selectedEmail?.id === email.id;

            return (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`cursor-pointer border-b border-white/5 p-4 transition hover:bg-white/10 ${
                  isSelected ? "bg-white/10" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {email.from || email.to || "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDate(email.time || email.sentAt || email.scheduledAt)}
                    </p>
                  </div>

                  {activeTab === "approval" && (
                    <input
                      type="checkbox"
                      checked={selectedApprovalIds.includes(email.id)}
                      onChange={() => toggleApprovalItem(email.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                    />
                  )}
                </div>

                <p className="mt-2 truncate text-sm font-medium text-gray-200">
                  {email.subject}
                </p>

                <p className="mt-1 truncate text-xs text-gray-400">{email.snippet}</p>

                {activeTab === "approval" && email.attachments?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {email.attachments.map((file: Attachment) => (
                      <span
                        key={file.name}
                        className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-gray-200"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {!selectedEmail ? (
            <div className="m-auto text-gray-400">Select an item to view</div>
          ) : (
            <>
              <div className="border-b border-white/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedEmail.subject}
                    </h2>

                    <p className="mt-1 text-sm text-gray-400">
                      {selectedEmail.from
                        ? `From: ${selectedEmail.from}`
                        : selectedEmail.to
                        ? `To: ${selectedEmail.to}`
                        : "No recipient available"}
                    </p>
                  </div>

                  {(selectedEmail.time ||
                    selectedEmail.sentAt ||
                    selectedEmail.scheduledAt) && (
                    <p className="text-xs text-gray-400">
                      {formatDate(
                        selectedEmail.time ||
                          selectedEmail.sentAt ||
                          selectedEmail.scheduledAt
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-200">
                <ReactMarkdown>
                  {selectedEmail.body || selectedEmail.snippet || "No content available."}
                </ReactMarkdown>

                {selectedEmail.attachments?.length ? (
                  <div className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-white">Attachments</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((file: Attachment) => (
                        <a
                          key={file.name}
                          href={file.url || "#"}
                          target={file.url ? "_blank" : undefined}
                          rel={file.url ? "noreferrer" : undefined}
                          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
                        >
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === "followUp" && selectedEmail.scheduledAt ? (
                  <div className="mt-6 text-xs text-gray-400">
                    Scheduled follow-up date: {formatDate(selectedEmail.scheduledAt)}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3 border-t border-white/10 p-4">
                <button className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">
                  Reply
                </button>

                <button className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
                  Forward
                </button>

                {activeTab === "approval" && (
                  <button
                    onClick={handleSendSelected}
                    disabled={
                      !selectedApprovalIds.includes(selectedEmail.id) && !approvalSelectedCount
                    }
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send Draft
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