"use client";

import { useState, useEffect, useRef } from "react";

type Email = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  time: string;
};

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // fake load (we’ll replace with Gmail API later)
  useEffect(() => {
  const fetchEmails = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/gmail/inbox");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load inbox");
      }

      setEmails(data.messages);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  fetchEmails();
}, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [emails]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Inbox</h1>

      {/* EMAIL FEED (chat-style container like your AI page) */}
      <div className="bg-white/5 p-4 rounded-xl h-[500px] overflow-y-auto space-y-3">
        {emails.map((email) => (
          <div key={email.id} className="text-left">
            <div className="inline-block w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 cursor-pointer transition">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-white">{email.from}</p>
                <p className="text-xs text-gray-400">{email.time}</p>
              </div>

              <p className="text-sm font-medium text-gray-200 mt-1">
                {email.subject}
              </p>

              <p className="text-sm text-gray-400">
                {email.snippet}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-sm text-gray-400">Loading inbox...</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Bottom bar (we’ll turn this into search + actions later) */}
      <div className="flex gap-2">
        <input
          className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/10"
          placeholder="Search emails..."
        />

        <button className="px-4 py-2 bg-blue-500 rounded-xl">
          Refresh
        </button>
      </div>
    </div>
  );
}