import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, ArrowLeft, Send, ChevronRight, Trash2, Search,
  Users, Wrench, Hash, User, Phone, Mail, X, UserPlus, LogOut,
} from "lucide-react";

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

// ── Types ─────────────────────────────────────────────────────────────────

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

type GroupMember = { id: number; displayName: string };

type GroupItem = {
  id: number;
  name: string;
  createdBy: number;
  lastMessageBody: string | null;
  lastMessageAt: string;
  lastSenderId: number | null;
  unreadCount: number;
  members: GroupMember[];
};

type GroupMessage = {
  id: number;
  groupId: number;
  senderId: number;
  senderName: string;
  body: string;
  createdAt: string;
};

type SuggestionUser = {
  id: number;
  displayName: string;
  username: string;
  tag: string;
};

type Suggestions = { defaults: SuggestionUser[]; search: SuggestionUser[] };

type ContactInfo = {
  id: number;
  displayName: string;
  phone: string | null;
  email: string | null;
  contactPublic: boolean;
  visible: boolean;
};

type AllMechanic = { id: number; displayName: string; username: string };

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function tagLabel(tag: string) {
  switch (tag) {
    case "client": return "CLIENT";
    case "shop": return "SAME SHOP";
    case "mechanic": return "YOUR MECHANIC";
    default: return "";
  }
}
function tagColor(tag: string) {
  switch (tag) {
    case "client": return "bg-teal-100 text-teal-800 border-teal-400";
    case "shop": return "bg-blue-100 text-blue-800 border-blue-400";
    case "mechanic": return "bg-purple-100 text-purple-800 border-purple-400";
    default: return "";
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const session = getSession();
  const myId = session?.mechanicId;

  // ── DM state ────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [activePartnerName, setActivePartnerName] = useState("");
  const [thread, setThread] = useState<Message[]>([]);
  const [newBody, setNewBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [confirmDeletePartnerId, setConfirmDeletePartnerId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Group state ──────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [activeGroupName, setActiveGroupName] = useState("");
  const [activeGroupMembers, setActiveGroupMembers] = useState<GroupMember[]>([]);
  const [activeGroupCreatedBy, setActiveGroupCreatedBy] = useState<number | null>(null);
  const [groupThread, setGroupThread] = useState<GroupMessage[]>([]);
  const [loadingGroupThread, setLoadingGroupThread] = useState(false);
  const [confirmLeaveGroupId, setConfirmLeaveGroupId] = useState<number | null>(null);
  const [leavingGroup, setLeavingGroup] = useState(false);

  // ── New conversation / group creation state ──────────────────────────────
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<Set<number>>(new Set());
  const [allMechanics, setAllMechanics] = useState<AllMechanic[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // ── Contact info modal (DM) ──────────────────────────────────────────────
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [fetchingContact, setFetchingContact] = useState(false);

  // ── Group members modal ──────────────────────────────────────────────────
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [groupMembersContact, setGroupMembersContact] = useState<ContactInfo[]>([]);
  const [fetchingGroupMembers, setFetchingGroupMembers] = useState(false);

  // ── Suggestion search ────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<Suggestions>({ defaults: [], search: [] });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchInbox = async () => {
    try {
      const r = await fetch(`${BASE}/api/messages/inbox`, { headers: authHeaders() });
      if (r.ok) setConversations(await r.json());
    } catch { /* ignore */ }
  };

  const fetchGroups = async () => {
    try {
      const r = await fetch(`${BASE}/api/groups`, { headers: authHeaders() });
      if (r.ok) setGroups(await r.json());
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

  const fetchGroupThread = async (groupId: number) => {
    setLoadingGroupThread(true);
    try {
      const r = await fetch(`${BASE}/api/groups/${groupId}/messages`, { headers: authHeaders() });
      if (r.ok) setGroupThread(await r.json());
      await fetch(`${BASE}/api/groups/${groupId}/read`, { method: "POST", headers: authHeaders() });
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, unreadCount: 0 } : g));
    } catch { /* ignore */ }
    setLoadingGroupThread(false);
  };

  const fetchSuggestions = async (q = "") => {
    setLoadingSuggestions(true);
    try {
      const url = q
        ? `${BASE}/api/mechanics/suggestions?q=${encodeURIComponent(q)}`
        : `${BASE}/api/mechanics/suggestions`;
      const r = await fetch(url, { headers: authHeaders() });
      if (r.ok) setSuggestions(await r.json());
    } catch { /* ignore */ }
    setLoadingSuggestions(false);
  };

  const fetchAllMechanics = async () => {
    try {
      const r = await fetch(`${BASE}/api/mechanics/list`, { headers: authHeaders() });
      if (r.ok) setAllMechanics(await r.json());
    } catch { /* ignore */ }
  };

  const fetchContact = async (partnerId: number) => {
    setFetchingContact(true);
    try {
      const r = await fetch(`${BASE}/api/mechanics/${partnerId}/contact`, { headers: authHeaders() });
      if (r.ok) setContactInfo(await r.json());
    } catch { /* ignore */ }
    setFetchingContact(false);
    setShowContactModal(true);
  };

  const fetchGroupMembersContact = async (members: GroupMember[]) => {
    setFetchingGroupMembers(true);
    setGroupMembersContact([]);
    setShowGroupMembersModal(true);
    try {
      const results = await Promise.all(
        members.map(async m => {
          const r = await fetch(`${BASE}/api/mechanics/${m.id}/contact`, { headers: authHeaders() });
          return r.ok ? (await r.json()) as ContactInfo : null;
        })
      );
      setGroupMembersContact(results.filter(Boolean) as ContactInfo[]);
    } catch { /* ignore */ }
    setFetchingGroupMembers(false);
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchInbox();
    fetchGroups();
    const iv1 = setInterval(fetchInbox, 10000);
    const iv2 = setInterval(fetchGroups, 10000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, []);

  useEffect(() => {
    if (showNewConvo) { setSearchQuery(""); fetchSuggestions(); }
  }, [showNewConvo]);

  useEffect(() => {
    if (showCreateGroup) { fetchAllMechanics(); setMemberSearch(""); setNewGroupName(""); setNewGroupMemberIds(new Set()); }
  }, [showCreateGroup]);

  useEffect(() => {
    if (!showNewConvo) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => fetchSuggestions(searchQuery), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (activePartnerId !== null) {
      const iv = setInterval(() => fetchThread(activePartnerId), 10000);
      return () => clearInterval(iv);
    }
  }, [activePartnerId]);

  useEffect(() => {
    if (activeGroupId !== null) {
      const iv = setInterval(() => fetchGroupThread(activeGroupId), 10000);
      return () => clearInterval(iv);
    }
  }, [activeGroupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, groupThread]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openConversation = (partnerId: number, partnerName: string) => {
    setActivePartnerId(partnerId);
    setActivePartnerName(partnerName);
    setActiveGroupId(null);
    setNewBody("");
    setConfirmDeletePartnerId(null);
    setContactInfo(null);
    setShowContactModal(false);
    fetchThread(partnerId);
    setShowNewConvo(false);
  };

  const openGroup = (g: GroupItem) => {
    setActiveGroupId(g.id);
    setActiveGroupName(g.name);
    setActiveGroupMembers(g.members);
    setActiveGroupCreatedBy(g.createdBy);
    setActivePartnerId(null);
    setNewBody("");
    setConfirmLeaveGroupId(null);
    setShowCreateGroup(false);
    setShowNewConvo(false);
    fetchGroupThread(g.id);
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
      if (r.ok) { setNewBody(""); await fetchThread(activePartnerId); await fetchInbox(); }
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleSendGroup = async () => {
    if (!newBody.trim() || !activeGroupId || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${BASE}/api/groups/${activeGroupId}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ body: newBody.trim() }),
      });
      if (r.ok) { setNewBody(""); await fetchGroupThread(activeGroupId); await fetchGroups(); }
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleDeleteConversation = async (partnerId: number) => {
    setDeleting(true);
    try {
      await fetch(`${BASE}/api/messages/conversation/${partnerId}`, { method: "DELETE", headers: authHeaders() });
      setConversations(prev => prev.filter(c => c.partnerId !== partnerId));
      if (activePartnerId === partnerId) { setActivePartnerId(null); setThread([]); }
    } catch { /* ignore */ }
    setDeleting(false);
    setConfirmDeletePartnerId(null);
  };

  const handleLeaveGroup = async (groupId: number) => {
    setLeavingGroup(true);
    try {
      await fetch(`${BASE}/api/groups/${groupId}/leave`, { method: "DELETE", headers: authHeaders() });
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (activeGroupId === groupId) { setActiveGroupId(null); setGroupThread([]); }
    } catch { /* ignore */ }
    setLeavingGroup(false);
    setConfirmLeaveGroupId(null);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || newGroupMemberIds.size === 0 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const r = await fetch(`${BASE}/api/groups`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: newGroupName.trim(), memberIds: Array.from(newGroupMemberIds) }),
      });
      if (r.ok) {
        await fetchGroups();
        setShowCreateGroup(false);
      }
    } catch { /* ignore */ }
    setCreatingGroup(false);
  };

  const toggleMember = (id: number) => {
    setNewGroupMemberIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Compose box shared helper ─────────────────────────────────────────────

  const ComposeBox = ({ onSend }: { onSend: () => void }) => (
    <div className="flex gap-3 items-end border-t-4 border-black pt-4">
      <textarea
        value={newBody}
        onChange={e => setNewBody(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        placeholder="Type a message..."
        rows={2}
        className="flex-1 resize-none rounded-xl border-4 border-black p-3 text-base font-medium bg-white text-black focus:outline-none focus:border-gray-500"
      />
      <Button type="button" size="lg" onClick={onSend} disabled={!newBody.trim() || sending} className="shrink-0">
        <Send className="w-5 h-5 mr-2" />SEND
      </Button>
    </div>
  );

  // ── View: DM thread ───────────────────────────────────────────────────────

  if (activePartnerId !== null) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-120px)]">
          <div className="flex items-center gap-3 mb-4 bg-gray-100 border-4 border-black rounded-xl p-4 shadow-brutal">
            <button
              type="button"
              onClick={() => { setActivePartnerId(null); setConfirmDeletePartnerId(null); }}
              className="flex items-center gap-2 font-black text-base border-2 border-black rounded-lg px-3 py-2 bg-white hover:bg-black hover:text-white transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />BACK
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
            {confirmDeletePartnerId === activePartnerId ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-black text-red-600 uppercase">Delete all?</span>
                <button type="button" disabled={deleting} onClick={() => handleDeleteConversation(activePartnerId)}
                  className="bg-red-600 text-white font-black text-sm px-3 py-2 rounded-lg border-2 border-red-700 uppercase hover:bg-red-700 disabled:opacity-50">
                  {deleting ? "..." : "YES"}
                </button>
                <button type="button" onClick={() => setConfirmDeletePartnerId(null)}
                  className="bg-white text-black font-black text-sm px-3 py-2 rounded-lg border-2 border-black uppercase hover:bg-gray-100">
                  NO
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDeletePartnerId(activePartnerId)}
                className="shrink-0 flex items-center gap-2 font-black text-sm border-2 border-red-300 text-red-600 rounded-lg px-3 py-2 bg-white hover:bg-red-50 hover:border-red-600 transition-all uppercase">
                <Trash2 className="w-4 h-4" />DELETE
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-1">
            {loadingThread && thread.length === 0 && <div className="text-center text-gray-500 font-bold py-8">Loading...</div>}
            {thread.map(msg => {
              const isMine = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? "bg-black text-white rounded-br-sm" : "bg-white border-2 border-gray-200 text-black rounded-bl-sm"}`}>
                    <p className="text-base leading-snug break-words">{msg.body}</p>
                    <p className={`text-xs mt-1.5 ${isMine ? "text-gray-400 text-right" : "text-gray-400"}`}>{formatTime(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <ComposeBox onSend={handleSend} />
        </div>

        {/* Contact modal */}
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowContactModal(false)}>
            <div className="bg-white border-4 border-black rounded-2xl shadow-brutal w-full max-w-sm p-6 space-y-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 border-2 border-black rounded-xl p-3"><User className="w-8 h-8" /></div>
                  <h2 className="text-2xl font-black uppercase leading-tight">{contactInfo?.displayName ?? activePartnerName}</h2>
                </div>
                <button type="button" onClick={() => setShowContactModal(false)} className="shrink-0 border-2 border-black rounded-lg p-2 bg-white hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {contactInfo?.visible ? (
                <div className="space-y-3">
                  {contactInfo.phone ? (
                    <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-4 border-4 border-black rounded-xl p-4 bg-white hover:bg-gray-50">
                      <Phone className="w-6 h-6 shrink-0" />
                      <div><p className="text-xs font-black uppercase text-gray-500">Phone</p><p className="text-xl font-black">{contactInfo.phone}</p></div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 border-4 border-gray-200 rounded-xl p-4 bg-gray-50">
                      <Phone className="w-6 h-6 shrink-0 text-gray-400" /><p className="text-base font-bold text-gray-400">No phone on file</p>
                    </div>
                  )}
                  {contactInfo.email ? (
                    <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-4 border-4 border-black rounded-xl p-4 bg-white hover:bg-gray-50">
                      <Mail className="w-6 h-6 shrink-0" />
                      <div><p className="text-xs font-black uppercase text-gray-500">Email</p><p className="text-xl font-black break-all">{contactInfo.email}</p></div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 border-4 border-gray-200 rounded-xl p-4 bg-gray-50">
                      <Mail className="w-6 h-6 shrink-0 text-gray-400" /><p className="text-base font-bold text-gray-400">No email on file</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-4 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  <p className="text-lg font-black text-gray-500 uppercase">Contact info is private</p>
                  <p className="text-sm font-medium text-gray-400 mt-1">This user has not made their contact info public.</p>
                </div>
              )}
              <button type="button" onClick={() => setShowContactModal(false)}
                className="w-full py-3 font-black uppercase text-base border-4 border-black rounded-xl bg-black text-white hover:bg-gray-900">
                CLOSE
              </button>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  // ── View: Group thread ────────────────────────────────────────────────────

  if (activeGroupId !== null) {
    const isConfirmingLeave = confirmLeaveGroupId === activeGroupId;
    const otherMembers = activeGroupMembers.filter(m => m.id !== myId);
    return (
      <Layout>
        <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-120px)]">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4 bg-blue-50 border-4 border-blue-600 rounded-xl p-4 shadow-brutal">
            <button
              type="button"
              onClick={() => { setActiveGroupId(null); setConfirmLeaveGroupId(null); }}
              className="flex items-center gap-2 font-black text-base border-2 border-black rounded-lg px-3 py-2 bg-white hover:bg-black hover:text-white transition-all shrink-0 mt-0.5"
            >
              <ArrowLeft className="w-5 h-5" />BACK
            </button>
            <button
              type="button"
              onClick={() => fetchGroupMembersContact(activeGroupMembers)}
              disabled={fetchingGroupMembers}
              className="flex-1 min-w-0 text-left group"
            >
              <h2 className="text-xl font-black uppercase truncate flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="underline decoration-dashed underline-offset-4 group-hover:decoration-solid">
                  {activeGroupName}
                </span>
              </h2>
              <p className="text-sm font-medium text-blue-700 truncate mt-0.5">
                {fetchingGroupMembers ? "Loading..." : `${activeGroupMembers.length} members — tap to view`}
              </p>
            </button>
            {isConfirmingLeave ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-black text-red-600 uppercase">Leave?</span>
                <button type="button" disabled={leavingGroup} onClick={() => handleLeaveGroup(activeGroupId)}
                  className="bg-red-600 text-white font-black text-sm px-3 py-2 rounded-lg border-2 border-red-700 uppercase disabled:opacity-50">
                  {leavingGroup ? "..." : "YES"}
                </button>
                <button type="button" onClick={() => setConfirmLeaveGroupId(null)}
                  className="bg-white text-black font-black text-sm px-3 py-2 rounded-lg border-2 border-black uppercase">
                  NO
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmLeaveGroupId(activeGroupId)}
                className="shrink-0 flex items-center gap-2 font-black text-sm border-2 border-red-300 text-red-600 rounded-lg px-3 py-2 bg-white hover:bg-red-50 hover:border-red-600 transition-all uppercase">
                <LogOut className="w-4 h-4" />LEAVE
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-1">
            {loadingGroupThread && groupThread.length === 0 && <div className="text-center text-gray-500 font-bold py-8">Loading...</div>}
            {groupThread.map(msg => {
              const isMine = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  {!isMine && (
                    <span className="text-xs font-black uppercase text-blue-700 px-1 mb-1">{msg.senderName}</span>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? "bg-black text-white rounded-br-sm" : "bg-white border-2 border-blue-200 text-black rounded-bl-sm"}`}>
                    <p className="text-base leading-snug break-words">{msg.body}</p>
                    <p className={`text-xs mt-1.5 ${isMine ? "text-gray-400 text-right" : "text-gray-400"}`}>{formatTime(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <ComposeBox onSend={handleSendGroup} />
        </div>

        {/* Group members modal */}
        {showGroupMembersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowGroupMembersModal(false)}>
            <div className="bg-white border-4 border-black rounded-2xl shadow-brutal w-full max-w-sm p-6 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 shrink-0">
                <h2 className="text-xl font-black uppercase flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-600" />
                  {activeGroupName}
                </h2>
                <button type="button" onClick={() => setShowGroupMembersModal(false)}
                  className="border-2 border-black rounded-lg p-2 bg-white hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm font-black uppercase text-gray-500 shrink-0">{activeGroupMembers.length} members</p>

              <div className="overflow-y-auto space-y-4 flex-1">
                {fetchingGroupMembers && (
                  <div className="text-center py-6 text-gray-400 font-bold">Loading contact info...</div>
                )}
                {!fetchingGroupMembers && groupMembersContact.map(c => (
                  <div key={c.id} className="border-4 border-black rounded-xl p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="bg-black text-white rounded-xl p-2 shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <p className="text-lg font-black uppercase leading-tight">{c.displayName}</p>
                      {c.id === myId && (
                        <span className="text-xs font-black uppercase bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-auto shrink-0">YOU</span>
                      )}
                    </div>
                    {c.visible ? (
                      <div className="space-y-2">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-3 border-2 border-black rounded-lg p-3 bg-white hover:bg-gray-50">
                            <Phone className="w-5 h-5 shrink-0" />
                            <div><p className="text-xs font-black uppercase text-gray-500">Phone</p><p className="text-base font-black">{c.phone}</p></div>
                          </a>
                        ) : (
                          <div className="flex items-center gap-3 border-2 border-gray-200 rounded-lg p-3 bg-gray-100">
                            <Phone className="w-5 h-5 shrink-0 text-gray-400" /><p className="text-sm font-bold text-gray-400">No phone on file</p>
                          </div>
                        )}
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-3 border-2 border-black rounded-lg p-3 bg-white hover:bg-gray-50">
                            <Mail className="w-5 h-5 shrink-0" />
                            <div><p className="text-xs font-black uppercase text-gray-500">Email</p><p className="text-base font-black break-all">{c.email}</p></div>
                          </a>
                        ) : (
                          <div className="flex items-center gap-3 border-2 border-gray-200 rounded-lg p-3 bg-gray-100">
                            <Mail className="w-5 h-5 shrink-0 text-gray-400" /><p className="text-sm font-bold text-gray-400">No email on file</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-gray-400 italic px-1">Contact info is private</p>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setShowGroupMembersModal(false)}
                className="w-full py-3 font-black uppercase text-base border-4 border-black rounded-xl bg-black text-white hover:bg-gray-900 shrink-0">
                CLOSE
              </button>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  // ── View: New DM picker ───────────────────────────────────────────────────

  if (showNewConvo) {
    const showingSearch = searchQuery.length > 0;
    const displayList = showingSearch ? suggestions.search : suggestions.defaults;
    const clientList = suggestions.defaults.filter(u => u.tag === "client");
    const shopList = suggestions.defaults.filter(u => u.tag === "shop");
    const mechanicList = suggestions.defaults.filter(u => u.tag === "mechanic");

    return (
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button type="button" onClick={() => setShowNewConvo(false)}
              className="flex items-center gap-2 font-black text-base border-2 border-black rounded-lg px-3 py-2 bg-white hover:bg-black hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />BACK
            </button>
            <h1 className="text-2xl font-black uppercase">New Message</h1>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or username..." className="pl-10 bg-white text-black text-lg border-4 border-black" />
          </div>
          {loadingSuggestions && <div className="text-center py-8 text-gray-400 font-bold">Loading...</div>}
          {!loadingSuggestions && (
            <>
              {showingSearch && (
                displayList.length === 0 ? (
                  <div className="text-center py-12 border-4 border-dashed border-gray-300 rounded-xl">
                    <p className="text-lg font-black text-gray-500 uppercase">No results for "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayList.map(u => <UserRow key={u.id} user={u} onClick={() => openConversation(u.id, u.displayName)} />)}
                  </div>
                )
              )}
              {!showingSearch && (
                suggestions.defaults.length === 0 ? (
                  <div className="text-center py-12 border-4 border-dashed border-gray-300 rounded-xl">
                    <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-black text-gray-500 uppercase">No suggested contacts</p>
                    <p className="text-gray-400 font-medium mt-2">Use the search bar to find someone to message.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {clientList.length > 0 && <Section icon={<Users className="w-5 h-5" />} label="Your Clients" users={clientList} onSelect={u => openConversation(u.id, u.displayName)} />}
                    {mechanicList.length > 0 && <Section icon={<Wrench className="w-5 h-5" />} label="Your Mechanic" users={mechanicList} onSelect={u => openConversation(u.id, u.displayName)} />}
                    {shopList.length > 0 && <Section icon={<Hash className="w-5 h-5" />} label="Same Shop" users={shopList} onSelect={u => openConversation(u.id, u.displayName)} />}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </Layout>
    );
  }

  // ── View: Create group ────────────────────────────────────────────────────

  if (showCreateGroup) {
    const filtered = memberSearch.trim()
      ? allMechanics.filter(m => m.id !== myId && (m.displayName.toLowerCase().includes(memberSearch.toLowerCase()) || m.username.toLowerCase().includes(memberSearch.toLowerCase())))
      : allMechanics.filter(m => m.id !== myId);

    return (
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button type="button" onClick={() => setShowCreateGroup(false)}
              className="flex items-center gap-2 font-black text-base border-2 border-black rounded-lg px-3 py-2 bg-white hover:bg-black hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />BACK
            </button>
            <h1 className="text-2xl font-black uppercase flex items-center gap-2">
              <Users className="w-7 h-7" />New Group
            </h1>
          </div>

          {/* Group name */}
          <div className="mb-5">
            <label className="block text-sm font-black uppercase mb-2 text-gray-600">Group Name</label>
            <Input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="e.g. Morning Crew, Shop A"
              className="bg-white text-black text-lg border-4 border-black"
            />
          </div>

          {/* Selected badge strip */}
          {newGroupMemberIds.size > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.from(newGroupMemberIds).map(id => {
                const m = allMechanics.find(x => x.id === id);
                if (!m) return null;
                return (
                  <button key={id} type="button" onClick={() => toggleMember(id)}
                    className="flex items-center gap-1.5 bg-blue-600 text-white font-black text-sm px-3 py-1.5 rounded-full">
                    {m.displayName} <X className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Member search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search members..." className="pl-10 bg-white text-black border-4 border-black" />
          </div>

          {/* Member list */}
          <div className="space-y-2 mb-6 max-h-80 overflow-y-auto">
            {filtered.length === 0 && <p className="text-center py-8 text-gray-400 font-bold">No users found.</p>}
            {filtered.map(m => {
              const selected = newGroupMemberIds.has(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggleMember(m.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-4 font-black text-left transition-all ${
                    selected ? "bg-blue-600 border-blue-700 text-white" : "bg-white border-black text-black hover:bg-gray-50"
                  }`}>
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${selected ? "bg-white border-white" : "border-gray-400"}`}>
                    {selected && <span className="text-blue-600 text-sm font-black">✓</span>}
                  </div>
                  <div>
                    <p className="text-lg font-black uppercase">{m.displayName}</p>
                    <p className={`text-sm font-medium ${selected ? "text-blue-200" : "text-gray-400"}`}>@{m.username}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <Button type="button" size="lg" className="w-full"
            onClick={handleCreateGroup}
            disabled={!newGroupName.trim() || newGroupMemberIds.size === 0 || creatingGroup}>
            <UserPlus className="w-5 h-5 mr-2" />
            {creatingGroup ? "CREATING..." : `CREATE GROUP (${newGroupMemberIds.size + 1} MEMBERS)`}
          </Button>
        </div>
      </Layout>
    );
  }

  // ── View: Unified inbox ───────────────────────────────────────────────────

  type InboxDM = { kind: "dm" } & Conversation;
  type InboxGroup = { kind: "group" } & GroupItem;
  type InboxItem = InboxDM | InboxGroup;

  const dmItems: InboxDM[] = conversations.map(c => ({ kind: "dm", ...c }));
  const groupItems: InboxGroup[] = groups.map(g => ({ kind: "group", ...g }));
  const allItems: InboxItem[] = [...dmItems, ...groupItems].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <h1 className="text-2xl font-black uppercase flex items-center gap-2 min-w-0">
            <MessageSquare className="w-7 h-7 shrink-0" />
            <span className="truncate">Messages</span>
          </h1>
          <div className="flex flex-col gap-2 shrink-0">
            <Button type="button" size="sm" onClick={() => setShowNewConvo(true)}>
              + MESSAGE
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateGroup(true)}
              className="border-4 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-black">
              <Users className="w-4 h-4 mr-1" />GROUP
            </Button>
          </div>
        </div>

        {allItems.length === 0 ? (
          <div className="text-center py-16 border-4 border-dashed border-gray-300 rounded-xl">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-xl font-black text-gray-500 uppercase">No messages yet</p>
            <p className="text-gray-400 font-medium mt-2">Start a conversation or create a group.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allItems.map(item => {
              if (item.kind === "dm") {
                const c = item;
                const isMine = c.lastSenderId === myId;
                const isConfirming = confirmDeletePartnerId === c.partnerId;
                return (
                  <div key={`dm-${c.partnerId}`} className="flex items-stretch bg-white border-4 border-black rounded-xl shadow-brutal overflow-hidden">
                    <button type="button" onClick={() => openConversation(c.partnerId, c.partnerName)}
                      className="flex-1 flex items-center gap-4 p-4 hover:bg-gray-50 transition-all text-left min-w-0">
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
                    <div className="shrink-0 flex items-center border-l-2 border-black">
                      {isConfirming ? (
                        <div className="flex items-center gap-1 px-3">
                          <span className="text-xs font-black text-red-600 uppercase">Delete?</span>
                          <button type="button" disabled={deleting} onClick={() => handleDeleteConversation(c.partnerId)}
                            className="bg-red-600 text-white font-black text-xs px-2 py-1.5 rounded border border-red-700 uppercase disabled:opacity-50">
                            {deleting ? "..." : "YES"}
                          </button>
                          <button type="button" onClick={() => setConfirmDeletePartnerId(null)}
                            className="bg-white text-black font-black text-xs px-2 py-1.5 rounded border border-gray-400 uppercase">
                            NO
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeletePartnerId(c.partnerId)}
                          className="flex items-center justify-center w-12 h-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // Group item
              const g = item;
              const isConfirmingLeave = confirmLeaveGroupId === g.id;
              const preview = g.lastMessageBody ?? "No messages yet";
              return (
                <div key={`group-${g.id}`} className="flex items-stretch bg-blue-50 border-4 border-blue-600 rounded-xl shadow-brutal overflow-hidden">
                  <button type="button" onClick={() => openGroup(g)}
                    className="flex-1 flex items-center gap-4 p-4 hover:bg-blue-100 transition-all text-left min-w-0">
                    <div className="bg-blue-600 text-white rounded-xl p-2 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-black uppercase truncate">{g.name}</span>
                        <span className="text-xs text-gray-500 font-bold shrink-0">{formatTime(g.lastMessageAt)}</span>
                      </div>
                      <p className={`text-sm truncate mt-0.5 ${g.unreadCount > 0 ? "font-black text-black" : "font-medium text-gray-500"}`}>
                        {preview}
                      </p>
                      <p className="text-xs text-blue-600 font-bold mt-0.5">{g.members.length} members</p>
                    </div>
                    {g.unreadCount > 0 && (
                      <span className="shrink-0 bg-blue-600 text-white text-sm font-black w-7 h-7 rounded-full flex items-center justify-center">
                        {g.unreadCount}
                      </span>
                    )}
                  </button>
                  <div className="shrink-0 flex items-center border-l-2 border-blue-400">
                    {isConfirmingLeave ? (
                      <div className="flex items-center gap-1 px-3">
                        <span className="text-xs font-black text-red-600 uppercase">Leave?</span>
                        <button type="button" disabled={leavingGroup} onClick={() => handleLeaveGroup(g.id)}
                          className="bg-red-600 text-white font-black text-xs px-2 py-1.5 rounded border border-red-700 uppercase disabled:opacity-50">
                          {leavingGroup ? "..." : "YES"}
                        </button>
                        <button type="button" onClick={() => setConfirmLeaveGroupId(null)}
                          className="bg-white text-black font-black text-xs px-2 py-1.5 rounded border border-gray-400 uppercase">
                          NO
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmLeaveGroupId(g.id)}
                        className="flex items-center justify-center w-12 h-full text-blue-400 hover:text-red-600 hover:bg-red-50 transition-all">
                        <LogOut className="w-4 h-4" />
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

// ── Sub-components ─────────────────────────────────────────────────────────

function UserRow({ user, onClick }: { user: SuggestionUser; onClick: () => void }) {
  const label = tagLabel(user.tag);
  const color = tagColor(user.tag);
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center justify-between bg-white border-4 border-black rounded-xl p-4 shadow-brutal hover:bg-black hover:text-white transition-all group">
      <div className="text-left flex-1 min-w-0">
        <p className="text-xl font-black uppercase truncate">{user.displayName}</p>
        <p className="text-sm font-medium text-gray-500 group-hover:text-gray-300">@{user.username}</p>
      </div>
      {label && (
        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded border ${color} mr-2 shrink-0 group-hover:opacity-0`}>{label}</span>
      )}
      <ChevronRight className="w-6 h-6 shrink-0" />
    </button>
  );
}

function Section({ icon, label, users, onSelect }: {
  icon: React.ReactNode; label: string; users: SuggestionUser[]; onSelect: (u: SuggestionUser) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500">{icon}</span>
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">{label}</h2>
      </div>
      <div className="space-y-3">
        {users.map(u => <UserRow key={u.id} user={u} onClick={() => onSelect(u)} />)}
      </div>
    </div>
  );
}
