"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type ChatMessage = { role: "user" | "assistant"; content: string };

type DraftAttachment = {
  name: string;
  url?: string | null;
  mimeType?: string | null;
  type?: string | null;
};

type LeadDraft = {
  company?: string;
  website?: string;
  email?: string;
  location?: string;
  draft?: { subject?: string; body?: string; attachments?: DraftAttachment[] };
  attachments?: DraftAttachment[];
};

type CreatedAttachment = { id?: string; name: string; url?: string | null; mimeType?: string | null };

type CreatedDraft = {
  id: string;
  to: string;
  from: string | null;
  subject: string;
  body: string;
  snippet: string | null;
  company: string | null;
  website: string | null;
  location: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  attachments: CreatedAttachment[];
};

type AIResponse = { reply?: string; leads?: LeadDraft[] };

type SavedChat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  drafts: CreatedDraft[];
  attachments: CreatedAttachment[];
  provider: "groq" | "openai";
  createdAt: number;
};

function normalizeText(v?: string | null) {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function draftKeyFromLead(l: Pick<CreatedDraft, "company" | "to" | "subject">) {
  return [normalizeText(l.company), normalizeText(l.to), normalizeText(l.subject)].join("|");
}

function draftKeyFromCreatedDraft(d: CreatedDraft) {
  return draftKeyFromLead({ company: d.company ?? "", to: d.to, subject: d.subject });
}

function leadKey(l: LeadDraft) {
  return [normalizeText(l.company), normalizeText(l.email), normalizeText(l.draft?.subject)].join("|");
}

function mergeUniqueDrafts(existing: CreatedDraft[], incoming: CreatedDraft[]) {
  const m = new Map<string, CreatedDraft>();
  for (const i of existing) m.set(draftKeyFromCreatedDraft(i), i);
  for (const i of incoming) m.set(draftKeyFromCreatedDraft(i), i);
  return Array.from(m.values());
}

function dedupeLeads(leads: LeadDraft[]) {
  const seen = new Set<string>();
  return leads.filter((l) => { const k = leadKey(l); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getChatTitle(msgs: ChatMessage[]): string {
  const first = msgs.find((m) => m.role === "user");
  if (!first) return "New Chat";
  return first.content.length > 40 ? first.content.slice(0, 40) + "..." : first.content;
}

function loadChats(): SavedChat[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem("ai-chats"); return r ? JSON.parse(r) : []; } catch { return []; }
}

function saveChats(chats: SavedChat[]) {
  try { localStorage.setItem("ai-chats", JSON.stringify(chats)); } catch {}
}

function loadActiveChatId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem("ai-active-chat-id") || null; } catch { return null; }
}

function saveActiveChatId(id: string | null) {
  try { if (id) localStorage.setItem("ai-active-chat-id", id); else localStorage.removeItem("ai-active-chat-id"); } catch {}
}

export default function AIPage() {
  const router = useRouter();

  const [chatList, setChatList] = useState<SavedChat[]>(() => loadChats());
  const [activeChatId, setActiveChatId] = useState<string | null>(() => loadActiveChatId());
  const [provider, setProvider] = useState<"groq" | "openai">(() => {
    if (typeof window === "undefined") return "groq";
    try { const s = localStorage.getItem("ai-chat-provider"); return s === "openai" ? "openai" : "groq"; } catch { return "groq"; }
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadedAttachments, setUploadedAttachments] = useState<CreatedAttachment[]>([]);
  const [drafts, setDrafts] = useState<CreatedDraft[]>([]);
  const [lastCreateStats, setLastCreateStats] = useState<{ createdCount: number; skippedCount: number; skippedReasons: string[] } | null>(null);
  const [showPreviewPopup, setShowPreviewPopup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [sentCompanies, setSentCompanies] = useState<Array<{ company: string; email: string; website: string | null }>>([]);

  // Load active chat data when activeChatId changes
  useEffect(() => {
    if (!activeChatId) { setMessages([]); setDrafts([]); setUploadedAttachments([]); return; }
    const chat = chatList.find((c) => c.id === activeChatId);
    if (chat) { setMessages(chat.messages); setDrafts(chat.drafts); setUploadedAttachments(chat.attachments); setProvider(chat.provider); }
  }, [activeChatId]);

  // Persist active chat data back to chatList
  useEffect(() => {
    if (!activeChatId) return;
    setChatList((prev) => {
      const idx = prev.findIndex((c) => c.id === activeChatId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], messages, drafts, attachments: uploadedAttachments, provider, title: getChatTitle(messages) };
      saveChats(updated);
      return updated;
    });
  }, [messages, drafts, uploadedAttachments, provider]);

  useEffect(() => { saveActiveChatId(activeChatId); }, [activeChatId]);
  useEffect(() => { try { localStorage.setItem("ai-chat-provider", provider); } catch {} }, [provider]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gmail/sent-companies");
        if (res.ok) { const data = await res.json(); if (Array.isArray(data.sentCompanies)) setSentCompanies(data.sentCompanies); }
      } catch { /* non-critical */ }
    })();
  }, []);

  function createNewChat() {
    const id = generateId();
    const newChat: SavedChat = { id, title: "New Chat", messages: [], drafts: [], attachments: [], provider, createdAt: Date.now() };
    setChatList((prev) => { const u = [newChat, ...prev]; saveChats(u); return u; });
    setActiveChatId(id);
    setInput("");
  }

  function deleteChat(id: string) {
    setChatList((prev) => { const u = prev.filter((c) => c.id !== id); saveChats(u); return u; });
    if (activeChatId === id) setActiveChatId(null);
  }

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const uniqueDrafts = useMemo(() => {
    const m = new Map<string, CreatedDraft>();
    for (const d of drafts) m.set(draftKeyFromCreatedDraft(d), d);
    return Array.from(m.values());
  }, [drafts]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function readFileAsBase64(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { const r = reader.result as string; const i = r.indexOf("base64,"); resolve(i === -1 ? r : r.slice(i + 7)); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileUpload(file: File) {
    try {
      const encodedName = encodeURIComponent(file.name);
      const res = await fetch("/api/uploads", { method: "POST", headers: { "x-file-name": encodedName, "x-file-mime": file.type || "application/pdf" }, body: file });
      let data: any = {};
      if (res.ok) data = await res.json().catch(() => ({}));
      const binaryWorked = res.ok && typeof data?.url === "string" && data.url.length > 0;
      if (!binaryWorked) {
        const base64 = await readFileAsBase64(file);
        const res2 = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mimeType: file.type || "application/pdf", data: base64 }) });
        data = await res2.json().catch(() => ({}));
        if (!res2.ok) throw new Error(data?.error || "Upload failed");
      }
      let fullUrl = data.url as string | undefined;
      if (fullUrl && !/^https?:\/\//i.test(fullUrl) && typeof window !== "undefined" && window.location) {
        fullUrl = `${window.location.origin.replace(/\/+$/, "")}/${fullUrl.replace(/^\/+/, "")}`;
      }
      setUploadedAttachments((prev) => [...prev, { name: data.name || file.name, url: fullUrl ?? null, mimeType: data.mimeType || file.type }]);
    } catch (err) {
      console.error("Upload error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to upload attachment." }]);
    }
  }

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setThinkingSteps(["Analyzing your request..."]);

    try {
      const existingLeads = [
        ...uniqueDrafts.map((d) => ({ company: d.company ?? d.to, website: d.website ?? "", email: d.to })),
        ...sentCompanies.map((sc) => ({ company: sc.company, website: sc.website ?? "", email: sc.email })),
      ];

      const aiEndpoint = provider === "openai" ? "/api/ai_openai" : "/api/ai_v3";
      setThinkingSteps((prev) => [...prev, provider === "openai" ? "Searching the web for leads..." : "Generating response..."]);
      const aiRes = await fetch(aiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: trimmed, existingLeads, attachments: uploadedAttachments }) });
      const aiData = (await aiRes.json()) as AIResponse & { error?: string; searchSteps?: { query: string; status: string }[] };
      if (!aiRes.ok) throw new Error(aiData.error || "AI failed");

      // Show web search queries as thinking steps
      if (Array.isArray(aiData.searchSteps) && aiData.searchSteps.length > 0) {
        setThinkingSteps((prev) => [...prev, ...aiData.searchSteps!.map((s) => `Searched: "${s.query}"`)]);
      }
      setThinkingSteps((prev) => [...prev, "Processing results..."]);

      let replyText = aiData.reply?.trim() || "Done.";
      let leadsForDrafts: LeadDraft[] = Array.isArray(aiData.leads) ? dedupeLeads(aiData.leads as LeadDraft[]) : [];

      if (replyText.startsWith("{") && leadsForDrafts.length === 0) {
        try {
          const blob = replyText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
          const nested = JSON.parse(blob) as AIResponse;
          if (nested && typeof nested.reply === "string" && Array.isArray(nested.leads)) { replyText = nested.reply.trim() || "Done."; leadsForDrafts = dedupeLeads(nested.leads as LeadDraft[]); }
        } catch { /* keep defaults */ }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);

      function unescapeNewlines(v?: string | null) { if (!v) return ""; return v.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").trim(); }

      const incomingLeads = leadsForDrafts.map((lead) => {
        const copy = { ...lead } as LeadDraft;
        if (copy.draft) copy.draft = { ...copy.draft, subject: unescapeNewlines(copy.draft.subject), body: unescapeNewlines(copy.draft.body), attachments: Array.isArray(copy.draft.attachments) ? copy.draft.attachments : [] };
        return copy;
      });

      if (uploadedAttachments.length > 0) {
        for (const lead of incomingLeads) {
          if (!lead.draft) lead.draft = {};
          const byKey = new Map<string, DraftAttachment>();
          for (const a of (Array.isArray(lead.draft.attachments) ? lead.draft.attachments : [])) { const u = ((a as DraftAttachment).url || "").trim(); byKey.set(u ? u.toLowerCase() : `name:${((a as DraftAttachment).name || "").toLowerCase()}`, a as DraftAttachment); }
          for (const u of uploadedAttachments) { const url = (u.url || "").trim(); byKey.set(url ? url.toLowerCase() : `name:${(u.name || "").toLowerCase()}`, { name: u.name, url: u.url ?? undefined, mimeType: u.mimeType ?? undefined }); }
          lead.draft.attachments = Array.from(byKey.values());
        }
      }

      if (incomingLeads.length > 0) {
        const optimisticDrafts: CreatedDraft[] = incomingLeads.map((lead, idx) => ({
          id: `optimistic-${Date.now()}-${idx}`, to: lead.email || "", from: lead.company || null,
          subject: lead.draft?.subject || "", body: lead.draft?.body || "", snippet: (lead.draft?.body || lead.draft?.subject || "").slice(0, 180),
          company: lead.company || null, website: lead.website || null, location: lead.location || null,
          scheduledAt: null, sentAt: null,
          attachments: (lead.draft?.attachments || lead.attachments || []).map((a) => ({ id: `opt-att-${Math.random().toString(36).slice(2, 9)}`, name: a.name, url: (a as any).url ?? null, mimeType: a.mimeType ?? a.type ?? null })),
        }));

        setDrafts((prev) => mergeUniqueDrafts(prev, optimisticDrafts));
        setLastCreateStats({ createdCount: optimisticDrafts.length, skippedCount: 0, skippedReasons: [] });
        console.log("CREATE DRAFTS PAYLOAD:", { leads: incomingLeads });

        const createRes = await fetch("/api/gmail/create-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leads: incomingLeads }) });
        const createData: { drafts?: CreatedDraft[]; error?: string; createdCount?: number; skipped?: any[] } = await createRes.json();
        if (!createRes.ok) {
          console.error("Draft creation failed:", createData);
          setMessages((prev) => [...prev, { role: "assistant", content: `Drafts were not saved: ${createData.error || createRes.statusText || "Unknown error"}` }]);
        } else {
          console.log("/api/gmail/create-drafts response:", createData);
          const createdDrafts: CreatedDraft[] = Array.isArray(createData.drafts) ? createData.drafts : [];
          const createdCount = typeof createData.createdCount === "number" ? createData.createdCount : createdDrafts.length;
          const skippedArr = Array.isArray(createData.skipped) ? createData.skipped : [];

          setLastCreateStats({ createdCount, skippedCount: skippedArr.length, skippedReasons: skippedArr.map((s: any) => s.reason || "unknown") });

          const summaryParts: string[] = [`Created ${createdCount} draft${createdCount === 1 ? "" : "s"}`];
          if (skippedArr.length > 0) summaryParts.push(`Skipped ${skippedArr.length}`);
          const summaryMsg = summaryParts.join(" — ");

          if (skippedArr.length > 0) {
            const reasons = skippedArr.map((s: any, i: number) => `${i + 1}. ${s.reason || "unknown"}`).join("; ");
            setMessages((prev) => [...prev, { role: "assistant", content: `${summaryMsg}. Reasons: ${reasons}` }]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: summaryMsg }]);
          }

          if (createdDrafts.length > 0) setDrafts((prev) => mergeUniqueDrafts(prev, createdDrafts));
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: AI failed to respond." }]);
    } finally {
      setLoading(false);
      setThinkingSteps([]);
    }
  };

  const goToApprovals = () => router.push("/dashboard/inbox?tab=approval");

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full gap-0 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`shrink-0 flex flex-col border-r border-white/10 bg-black/30 p-3 transition-[width,opacity] duration-300 ease-in-out overflow-hidden ${sidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 p-0 border-r-0"}`}
      >
          <button onClick={createNewChat} className="mb-3 w-full rounded-xl bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600">
            + New Chat
          </button>
          <div className="flex-1 overflow-y-auto space-y-1">
            {chatList.length === 0 && <div className="px-2 text-xs text-gray-500">No chats yet</div>}
            {chatList.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-left transition cursor-pointer ${
                  activeChatId === chat.id ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
                onClick={() => setActiveChatId(chat.id)}
              >
                <span className="flex-1 truncate text-sm">{chat.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                  className="shrink-0 text-xs text-gray-500 opacity-0 group-hover:opacity-100 hover:text-rose-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${sidebarOpen ? "" : "rotate-180"}`}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-white">AI Assistant</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as "groq" | "openai")}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none"
            >
              <option value="groq">Groq (Llama 3.3 70B)</option>
              <option value="openai">OpenAI (GPT-4.1 Mini)</option>
            </select>
            {uniqueDrafts.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowPreviewPopup(!showPreviewPopup)}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30"
                >
                  Chat Previews ({uniqueDrafts.length})
                </button>
                {showPreviewPopup && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/10 bg-gray-900 p-4 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Drafted Companies</h3>
                      <button onClick={() => setShowPreviewPopup(false)} className="text-xs text-gray-400 hover:text-white">Close</button>
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {uniqueDrafts.map((draft) => (
                        <div key={draft.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="truncate text-sm font-semibold text-white">{draft.company || draft.to}</div>
                          {draft.website && (
                            <a href={draft.website} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-blue-400 hover:underline">{draft.website}</a>
                          )}
                          {draft.to ? (
                            <div className="mt-1 truncate text-xs text-gray-400">{draft.to}</div>
                          ) : (
                            <div className="mt-1 text-xs italic text-gray-500">No email found</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { goToApprovals(); setShowPreviewPopup(false); }}
                      className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                    >
                      Go to Approvals
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-3">
            {!activeChatId && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 text-4xl">🤖</div>
                <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
                <p className="mt-2 text-sm text-gray-400">Ask me to find shippers, build outreach drafts, or compile leads.</p>
                <button onClick={createNewChat} className="mt-4 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600">
                  Start a New Chat
                </button>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
                <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-white/10 text-gray-100"}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-left">
                <div className="inline-block max-w-[85%] rounded-2xl bg-white/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="font-medium">Thinking</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {thinkingSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                        <svg className={`h-3 w-3 shrink-0 ${i === thinkingSteps.length - 1 ? "animate-pulse text-blue-400" : "text-emerald-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          {i < thinkingSteps.length - 1 ? <><path d="M20 6L9 17l-5-5" /></> : <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>}
                        </svg>
                        <span className={i === thinkingSteps.length - 1 ? "text-gray-300" : ""}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                className="flex-1 rounded-2xl border border-blue-400/60 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-blue-400"
                placeholder="Ask AI to find leads, draft emails..."
              />
              <label className="inline-flex cursor-pointer items-center rounded-2xl bg-purple-500 px-4 py-3 text-white hover:bg-purple-600">
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={async (e) => { const files = Array.from(e.target.files || []); if (!files.length) return; for (const file of files) await handleFileUpload(file); e.currentTarget.value = ""; }}
                  className="hidden"
                />
                PDFs
              </label>
              <button onClick={sendMessage} disabled={loading} className="rounded-2xl bg-blue-500 px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50">
                Send
              </button>
            </div>
            {uploadedAttachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {uploadedAttachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-gray-200">
                    <span className="max-w-[10rem] truncate">{a.name}</span>
                    <button onClick={() => setUploadedAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-[11px] text-rose-400">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
