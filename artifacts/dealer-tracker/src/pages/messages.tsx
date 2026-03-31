import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowLeft, Send, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getSession() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    return JSON.parse(raw) as { mechanicId: number; displayName: string };
  } catch { return null; }
}

function authHeaders() {
  const s = getSession();
  return { "Content-Type": "application/json", "X-Mechanic-Id": String(s?.mechanicId ?? "") };
}

type Conversation = {
  partnerId: number;
  partnerName: string;
  lastMessageBody: string;
  lastMessageAt: string;
  unreadCount: number;
  lastSenderId: number;
};

type Message = {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type Mechanic = {
  id: number;
  displayName: string;
  username: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessagesPage() {
  const session = getSession();
  const myId = session?.mechanicId;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [activePartnerName, setActivePartnerName] = useState("");
  const [thread, setThread] = useState<Message[]>([]);
  const [newBody, setNewBody] = useState("");
  const [sending, setSending] = useState(false);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchInbox = async () => {
    try {
      const r = await fetch(`${BASE}/api/messages/inbox`, { headers: authHeaders() });
      if (r.ok) setConversations(await r.json());
    } catch { /* ignore */ }
  };

  const fetchThread = async (partnerId: number) => {
    setLoadingThread(true);
    try {
      const r = await fetch(`${BASE}/api/messages/thread/${partnerId}`, { headers: authHeaders() });
      if (r.ok) setThread(await r.json());
      // mark as read
      await fetch(`${BASE}/api/messages/read/${partnerId}`, { method: "POST", headers: authHeaders() });
      // update inbox unread count
      setConversations(prev => prev.map(c => c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c));
    } catch { /* ignore */ }
    setLoadingThread(false);
  };

  const fetchMechanics = async () => {
    try {
      const r = await fetch(`${BASE}/api/mechanics/list`, { headers: authHeaders() });
      if (r.ok) setMechanics(await r.json());
    } catch { /* ignore */ }
  };

  // Initial load + polling
  useEffect(() => {
    fetchInbox();
    fetchMechanics();
    const iv = setInterval(fetchInbox, 10000);
    return () => clearInterval(iv);
  }, []);

  // Poll active thread
  useEffect(() => {
    if (activePartnerId === null) return;
    const iv = setInterval(() => fetchThread(activePartnerId), 10000);
    return () => clearInterval(iv);
  }, [activePartnerId]);

  // Auto-scroll to bottom of thread
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const openConversation = (partnerId: number, partnerName: string) => {
    setActivePartnerId(partnerId);
    setActivePartnerName(partnerName);
    setNewBody("");
    fetchThread(partnerId);
    setShowNewConvo(false);
  };

  const handleSend = async () => {
    if (!newBody.trim() || !activePartnerId || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${BASE}/api/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ recipientId: activePartnerId, body: newBody.trim() }),
      });
      if (r.ok) {
        setNewBody("");
        await fetchThread(activePartnerId);
        await fetchInbox();
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  const availableMechanics = mechanics.filter(m => m.id !== myId);

  // ── Thread view ──────────────────────────────────────────────────────────
  if (activePartnerId !== null) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-120px)]">
          {/* Header */}
          <div className="flex items-center gap-4 mb-4 bg-gray-100 border-4 border-black rounded-xl p-4 shadow-brutal">
            <button
              type="button"
              onClick={() => setActivePartnerId(null)}
              className="flex items-center gap-2 font-black text-base border-2 border-black rounded-lg px-3 py-2 bg-white hover:bg-black hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              BACK
            </button>
            <div>
              <h2 className="text-xl font-black uppercase">{activePartnerName}</h2>
              <p className="text-gray-500 text-sm font-medium">Conversation</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-1">
            {loadingThread && thread.length === 0 && (
              <div className="text-center text-gray-500 font-bold py-8">Loading...</div>
            )}
            {!loadingThread && thread.length === 0 && (
              <div className="text-center text-gray-500 font-bold py-8 text-lg">
                No messages yet. Say hello!
              </div>
            )}
            {thread.map(msg => {
              const isMine = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] px-4 py-3 rounded-2xl border-2 border-black shadow-brutal-sm ${
                      isMine
                        ? "bg-black text-white rounded-br-none"
                        : "bg-white text-black rounded-bl-none"
                    }`}
                  >
                    <p className="text-base font-medium leading-snug break-words">{msg.body}</p>
                    <p className={`text-xs mt-1 font-bold ${isMine ? "text-gray-400 text-right" : "text-gray-500"}`}>
                      {formatTime(msg.createdAt)}
                      {isMine && msg.readAt && " · Read"}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Send bar */}
          <div className="flex gap-3 items-end border-4 border-black rounded-xl bg-gray-100 p-3 shadow-brutal">
            <textarea
              className="flex-1 resize-none border-2 border-black rounded-lg p-3 text-base font-medium bg-white text-black min-h-[52px] max-h-32 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Type a message…"
              value={newBody}
              rows={1}
              onChange={e => setNewBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              type="button"
              size="lg"
              onClick={handleSend}
              disabled={!newBody.trim() || sending}
              className="shrink-0"
            >
              <Send className="w-5 h-5 mr-2" />
              SEND
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── New conversation picker ──────────────────────────────────────────────
  if (showNewConvo) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => setShowNewConvo(false)}
              className="flex items-center gap-2 font-black text-base border-2 border-black rounded-lg px-3 py-2 bg-white hover:bg-black hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              BACK
            </button>
            <h1 className="text-2xl font-black uppercase">New Message</h1>
          </div>
          {availableMechanics.length === 0 ? (
            <div className="text-center text-gray-500 font-bold py-12 text-lg border-4 border-dashed border-gray-300 rounded-xl">
              No other mechanics to message.
            </div>
          ) : (
            <div className="space-y-3">
              {availableMechanics.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openConversation(m.id, m.displayName)}
                  className="w-full flex items-center justify-between bg-white border-4 border-black rounded-xl p-5 shadow-brutal hover:bg-black hover:text-white transition-all group"
                >
                  <div className="text-left">
                    <p className="text-xl font-black uppercase">{m.displayName}</p>
                    <p className="text-sm font-medium text-gray-500 group-hover:text-gray-300">@{m.username}</p>
                  </div>
                  <ChevronRight className="w-6 h-6" />
                </button>
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ── Inbox ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black uppercase flex items-center gap-3">
            <MessageSquare className="w-8 h-8" />
            Messages
          </h1>
          <Button
            type="button"
            size="lg"
            onClick={() => setShowNewConvo(true)}
          >
            + NEW MESSAGE
          </Button>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-16 border-4 border-dashed border-gray-300 rounded-xl">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-xl font-black text-gray-500 uppercase">No messages yet</p>
            <p className="text-gray-400 font-medium mt-2">Start a conversation with a teammate.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map(c => {
              const isMine = c.lastSenderId === myId;
              return (
                <button
                  key={c.partnerId}
                  type="button"
                  onClick={() => openConversation(c.partnerId, c.partnerName)}
                  className="w-full flex items-center gap-4 bg-white border-4 border-black rounded-xl p-4 shadow-brutal hover:bg-gray-50 transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-black uppercase truncate">{c.partnerName}</span>
                      <span className="text-xs text-gray-500 font-bold shrink-0">{formatTime(c.lastMessageAt)}</span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${c.unreadCount > 0 ? "font-black text-black" : "font-medium text-gray-500"}`}>
                      {isMine ? "You: " : ""}{c.lastMessageBody}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 bg-black text-white text-sm font-black w-7 h-7 rounded-full flex items-center justify-center">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
