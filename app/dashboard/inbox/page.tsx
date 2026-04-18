"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

type Email = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  body?: string;
  time?: string;
};

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔄 Fetch inbox
  useEffect(() => {
    const fetchEmails = async () => {
      setLoading(true);

      try {
        const res = await fetch("/api/gmail/inbox");
        const data = await res.json();

        setEmails(data.messages || []);
        setSelectedEmail(data.messages?.[0] || null); // auto-open first email
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    };

    fetchEmails();
  }, []);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-gray-400">
          Your connected Gmail inbox
        </p>
      </div>

      {/* MAIN 2-PANE LAYOUT */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* 📥 LEFT: EMAIL LIST */}
        <div className="w-[380px] overflow-y-auto rounded-2xl bg-white/5 border border-white/10">
          {loading && (
            <div className="p-4 text-sm text-gray-400">
              Loading inbox...
            </div>
          )}

          {emails.map((email) => (
            <div
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              className={`p-4 border-b border-white/5 cursor-pointer transition hover:bg-white/10 ${
                selectedEmail?.id === email.id
                  ? "bg-white/10"
                  : ""
              }`}
            >
              <div className="flex justify-between items-center">
                <p className="font-semibold text-sm text-white truncate">
                  {email.from}
                </p>
                <p className="text-xs text-gray-400">
                  {email.time || ""}
                </p>
              </div>

              <p className="text-sm text-gray-200 mt-1 font-medium truncate">
                {email.subject}
              </p>

              <p className="text-xs text-gray-400 truncate mt-1">
                {email.snippet}
              </p>
            </div>
          ))}
        </div>

        {/* 📧 RIGHT: EMAIL READER */}
        <div className="flex-1 flex flex-col rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          
          {!selectedEmail ? (
            <div className="m-auto text-gray-400">
              Select an email to view
            </div>
          ) : (
            <>
              {/* HEADER */}
              <div className="p-5 border-b border-white/10">
                <h2 className="text-lg font-semibold">
                  {selectedEmail.subject}
                </h2>

                <p className="text-sm text-gray-400 mt-1">
                  From: {selectedEmail.from}
                </p>
              </div>

              {/* BODY */}
              <div className="flex-1 p-5 overflow-y-auto text-sm text-gray-200">
                <ReactMarkdown>
                  {selectedEmail.body ||
                    selectedEmail.snippet ||
                    "No content available."}
                </ReactMarkdown>
              </div>

              {/* ACTIONS (Reply / Forward) */}
              <div className="p-4 border-t border-white/10 flex gap-3">
                <button className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm">
                  Reply
                </button>

                <button className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm">
                  Forward
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}