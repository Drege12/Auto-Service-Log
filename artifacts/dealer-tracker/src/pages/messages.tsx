import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, ArrowLeft, Send, ChevronRight, Trash2, Search, Users, Wrench, Hash, User, Phone, Mail, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getSession() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    return JSON.parse(raw) as { mechanicId: number; displayName: string; role?: string };
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

type SuggestionUser = {
  id: number;
  displayName: string;
  username: string;
  tag: string; // "client" | "shop" | "mechanic" | "result"
};

type ContactInfo = {
  id: number;
  displayName: string;
  phone: string | null;
  email: string | null;
  contactPublic: boolean;
  visible: boolean;
};

type Suggestions = {
  defaults: SuggestionUser[];
  search: SuggestionUser[];
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

function tagLabel(tag: string): string {
  switch (tag) {
    case "client": return "CLIENT";
    case "shop": return "SAME SHOP";
    case "mechanic": return "YOUR MECHANIC";
    default: return "";
  }
}

function tagColor(tag: string): string {
  switch (tag) {
    case "client": return "bg-teal-100 text-teal-800 border-teal-400";
    case "shop": return "bg-blue-100 text-blue-800 border-blue-400";
    case "mechanic": return "bg-purple-100 text-purple-800 border-purple-400";
    default: return "";
  }
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
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [confirmDeletePartnerId, setConfirmDeletePartnerId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [fetchingContact, setFetchingContact] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestions>({ defaults: [], search: [] });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      await fetch(`${BASE}/api/messages/read/${partnerId}`, { method: "POST", headers: authHeaders() });
      setConversations(prev => prev.map(c => c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c));
    } catch { /* ignore */ }
    setLoadingThread(false);
  };

  const fetchSuggestions = async (q = "") => {
    setLoadingSuggestions(true);
    try {
      const url = q ? `${BASE}/api/mechanics/suggestions?q=${encodeURIComponent(q)}` : `${BASE}/api/mechanics/suggestions`;
      const r = await fetch(url, { headers: authHeaders() });
      if (r.ok) setSuggestions(await r.json());
    } catch { /* ignore */ }
    setLoadingSuggestions(false);
  };

  const handleDeleteConversation = async (partnerId: number) => {
    setDeleting(true);
    try {
      await fetch(`${BASE}/api/messages/conversation/${partnerId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setConversations(prev => prev.filter(c => c.partnerId !== partnerId));
      if (activePartnerId === partnerId) {
        setActivePartnerId(null);
        setThread([]);
      }
    } catch { /* ignore */ }
    setDeleting(false);
    setConfirmDeletePartnerId(null);
  };

  // Initial inbox load + polling
  useEffect(() => {
    fetchInbox();
    const iv = setInterval(fetchInbox, 10000);
    return () => clearInterval(iv);
  }, []);

  // Load suggestions when new conversation panel opens
  useEffect(() => {
    if (showNewConvo) {
      setSearchQuery("");
      fetchSuggestions();
    }
  }, [showNewConvo]);

  // Debounced search
  useEffect(() => {
    if (!showNewConvo) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

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

  const fetchContact = async (partnerId: number) => {
    setFetchingContact(true);
    try {
      const r = await fetch(`${BASE}/api/mechanics/${partnerId}/contact`, { headers: authHeaders() });
      if (r.ok) setContactInfo(await r.json());
    } catch { /* ignore */ }
    setFetchingContact(false);
    setShowContactModal(true);
  };

  const openConversation = (partnerId: number, partnerName: string) => {
    setActivePartnerId(partnerId);
    setActivePartnerName(partnerName);
    setNewBody("");
    setConfirmDeletePartnerId(null);
    setContactInfo(null);
    setShowContactModal(false);
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

  // ── Thread view ──────────────────────────────────────────────────────────
  if (activePartnerId !== null) {
    const isConfirmingDelete = confirmDeletePartnerId === activePartnerId;
    return (
      <Layout>
        <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-120px)]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 bg-gray-100 border-4 border-black rounded-xl p-4 shadow-brutal">
            <button
              type="button"
              onClick={() => { setActivePartnerId(null); setConfirmDeletePartnerId(null); }}
              className="flex items-center gap-2 font-black text-base border-2 border-black rounded-lg px-3 py-2 bg-white hover:bg-black hover:text-white transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
              BACK
            </button>
            <button
              type="button"
              onClick={() => fetchContact(activePartnerId)}
              disabled={fetchingContact}
              className="flex-1 min-w-0 text-left group"
            >
              <h2 className="text-xl font-black uppercase truncate underline decoration-dashed underline-offset-4 group-hover:decoration-solid">
                {activePartnerName}
              </h2>
              <p className="text-gray-500 text-sm font-medium">
                {fetchingContact ? "Loading..." : "Tap name to view contact"}
              </p>
            </button>
            {isConfirmingDelete ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-black text-red-600 uppercase">Delete all?</span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleDeleteConversation(activePartnerId)}
                  className="bg-red-600 text-white font-black text-sm px-3 py-2 rounded-lg border-2 border-red-700 uppercase hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "..." : "YES"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeletePartnerId(null)}
                  className="bg-white text-black font-black text-sm px-3 py-2 rounded-lg border-2 border-black uppercase hover:bg-gray-100"
                >
                  NO
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeletePartnerId(activePartnerId)}
                className="shrink-0 flex items-center gap-2 font-black text-sm border-2 border-red-300 text-red-600 rounded-lg px-3 py-2 bg-white hover:bg-red-50 hover:border-red-600 transition-all uppercase"
              >
                <Trash2 className="w-4 h-4" />
                DELETE
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-1">
            {loadingThread && thread.length === 0 && (
              <div className="text-center text-gray-500 font-bold py-8">Loading...</div>
            )}
            {thread.map(msg => {
              const isMine = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                      isMine
                        ? "bg-black text-white rounded-br-sm"
                        : "bg-white border-2 border-gray-200 text-black rounded-bl-sm"
                    }`}
                  >
                    <p className="text-base leading-snug break-words">{msg.body}</p>
                    <p className={`text-xs mt-1.5 ${isMine ? "text-gray-400 text-right" : "text-gray-400"}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Compose */}
          <div className="flex gap-3 items-end border-t-4 border-black pt-4">
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Type a message..."
              rows={2}
              className="flex-1 resize-none rounded-xl border-4 border-black p-3 text-base font-medium bg-white text-black focus:outline-none focus:border-gray-500"
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

        {/* Contact info modal */}
        {showContactModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowContactModal(false)}
          >
            <div
              className="bg-white border-4 border-black rounded-2xl shadow-brutal w-full max-w-sm p-6 space-y-5"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 border-2 border-black rounded-xl p-3">
                    <User className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black uppercase leading-tight">
                    {contactInfo?.displayName ?? activePartnerName}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="shrink-0 border-2 border-black rounded-lg p-2 bg-white hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contact details */}
              {contactInfo?.visible ? (
                <div className="space-y-3">
                  {contactInfo.phone ? (
                    <a
                      href={`tel:${contactInfo.phone}`}
                      className="flex items-center gap-4 border-4 border-black rounded-xl p-4 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Phone className="w-6 h-6 shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase text-gray-500">Phone</p>
                        <p className="text-xl font-black">{contactInfo.phone}</p>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 border-4 border-gray-200 rounded-xl p-4 bg-gray-50">
                      <Phone className="w-6 h-6 shrink-0 text-gray-400" />
                      <p className="text-base font-bold text-gray-400">No phone on file</p>
                    </div>
                  )}
                  {contactInfo.email ? (
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className="flex items-center gap-4 border-4 border-black rounded-xl p-4 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Mail className="w-6 h-6 shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase text-gray-500">Email</p>
                        <p className="text-xl font-black break-all">{contactInfo.email}</p>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 border-4 border-gray-200 rounded-xl p-4 bg-gray-50">
                      <Mail className="w-6 h-6 shrink-0 text-gray-400" />
                      <p className="text-base font-bold text-gray-400">No email on file</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-4 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  <p className="text-lg font-black text-gray-500 uppercase">Contact info is private</p>
                  <p className="text-sm font-medium text-gray-400 mt-1">This user has not made their contact info public.</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="w-full py-3 font-black uppercase text-base border-4 border-black rounded-xl bg-black text-white hover:bg-gray-900 transition-all"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  // ── New conversation picker ──────────────────────────────────────────────
  if (showNewConvo) {
    const showingSearch = searchQuery.length > 0;
    const displayList = showingSearch ? suggestions.search : suggestions.defaults;

    // Group defaults by tag for labelled sections
    const clientList = suggestions.defaults.filter(u => u.tag === "client");
    const shopList = suggestions.defaults.filter(u => u.tag === "shop");
    const mechanicList = suggestions.defaults.filter(u => u.tag === "mechanic");

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

          {/* Search input */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or username..."
              className="pl-10 bg-white text-black text-lg border-4 border-black"
            />
          </div>

          {loadingSuggestions && (
            <div className="text-center py-8 text-gray-400 font-bold">Loading...</div>
          )}

          {!loadingSuggestions && (
            <>
              {/* Search results */}
              {showingSearch && (
                <>
                  {displayList.length === 0 ? (
                    <div className="text-center py-12 border-4 border-dashed border-gray-300 rounded-xl">
                      <p className="text-lg font-black text-gray-500 uppercase">No results for "{searchQuery}"</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayList.map(u => (
                        <UserRow key={u.id} user={u} onClick={() => openConversation(u.id, u.displayName)} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Default sections */}
              {!showingSearch && (
                <>
                  {suggestions.defaults.length === 0 ? (
                    <div className="text-center py-12 border-4 border-dashed border-gray-300 rounded-xl">
                      <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-lg font-black text-gray-500 uppercase">No suggested contacts</p>
                      <p className="text-gray-400 font-medium mt-2">Use the search bar to find someone to message.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {clientList.length > 0 && (
                        <Section
                          icon={<Users className="w-5 h-5" />}
                          label="Your Clients"
                          users={clientList}
                          onSelect={u => openConversation(u.id, u.displayName)}
                        />
                      )}
                      {mechanicList.length > 0 && (
                        <Section
                          icon={<Wrench className="w-5 h-5" />}
                          label="Your Mechanic"
                          users={mechanicList}
                          onSelect={u => openConversation(u.id, u.displayName)}
                        />
                      )}
                      {shopList.length > 0 && (
                        <Section
                          icon={<Hash className="w-5 h-5" />}
                          label="Same Shop"
                          users={shopList}
                          onSelect={u => openConversation(u.id, u.displayName)}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </>
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
              const isConfirming = confirmDeletePartnerId === c.partnerId;
              return (
                <div
                  key={c.partnerId}
                  className="flex items-stretch bg-white border-4 border-black rounded-xl shadow-brutal overflow-hidden"
                >
                  {/* Main clickable area */}
                  <button
                    type="button"
                    onClick={() => openConversation(c.partnerId, c.partnerName)}
                    className="flex-1 flex items-center gap-4 p-4 hover:bg-gray-50 transition-all text-left min-w-0"
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

                  {/* Delete / confirm area */}
                  <div className="shrink-0 flex items-center border-l-2 border-black">
                    {isConfirming ? (
                      <div className="flex items-center gap-1 px-3">
                        <span className="text-xs font-black text-red-600 uppercase">Delete?</span>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => handleDeleteConversation(c.partnerId)}
                          className="bg-red-600 text-white font-black text-xs px-2 py-1.5 rounded border border-red-700 uppercase disabled:opacity-50"
                        >
                          {deleting ? "..." : "YES"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePartnerId(null)}
                          className="bg-white text-black font-black text-xs px-2 py-1.5 rounded border border-gray-400 uppercase"
                        >
                          NO
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePartnerId(c.partnerId)}
                        className="flex items-center justify-center w-12 h-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function UserRow({ user, onClick }: { user: SuggestionUser; onClick: () => void }) {
  const label = tagLabel(user.tag);
  const color = tagColor(user.tag);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between bg-white border-4 border-black rounded-xl p-4 shadow-brutal hover:bg-black hover:text-white transition-all group"
    >
      <div className="text-left flex-1 min-w-0">
        <p className="text-xl font-black uppercase truncate">{user.displayName}</p>
        <p className="text-sm font-medium text-gray-500 group-hover:text-gray-300">@{user.username}</p>
      </div>
      {label && (
        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded border ${color} mr-2 shrink-0 group-hover:opacity-0`}>
          {label}
        </span>
      )}
      <ChevronRight className="w-6 h-6 shrink-0" />
    </button>
  );
}

function Section({
  icon, label, users, onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  users: SuggestionUser[];
  onSelect: (u: SuggestionUser) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500">{icon}</span>
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">{label}</h2>
      </div>
      <div className="space-y-3">
        {users.map(u => (
          <UserRow key={u.id} user={u} onClick={() => onSelect(u)} />
        ))}
      </div>
    </div>
  );
}
