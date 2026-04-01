import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Bell, Wrench, ClipboardList, CheckSquare, Gauge, StickyNote, Link2, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    const s = raw ? JSON.parse(raw) as { mechanicId: number } : null;
    return { "Content-Type": "application/json", "X-Mechanic-Id": String(s?.mechanicId ?? "") };
  } catch { return { "Content-Type": "application/json", "X-Mechanic-Id": "" }; }
}

type Notification = {
  id: number;
  actorId: number | null;
  carId: number;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  carYear: number | null;
  carMake: string | null;
  carModel: string | null;
  actorName: string | null;
};

function typeIcon(type: string) {
  switch (type) {
    case "maintenance_added": return <Wrench className="w-5 h-5 text-blue-600" />;
    case "inspection_saved":  return <ClipboardList className="w-5 h-5 text-purple-600" />;
    case "todo_added":        return <CheckSquare className="w-5 h-5 text-orange-500" />;
    case "mileage_added":     return <Gauge className="w-5 h-5 text-teal-600" />;
    case "notes_updated":     return <StickyNote className="w-5 h-5 text-amber-600" />;
    case "linked":            return <Link2 className="w-5 h-5 text-green-600" />;
    default:                  return <Bell className="w-5 h-5 text-gray-500" />;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    try {
      const r = await fetch(`${BASE}/api/notifications`, { headers: authHeaders() });
      if (r.ok) setNotifications(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch(`${BASE}/api/notifications/read-all`, { method: "POST", headers: authHeaders() });
      setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
    } catch { /* ignore */ }
    setMarkingAll(false);
  };

  const handleDismiss = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${BASE}/api/notifications/${id}`, { method: "DELETE", headers: authHeaders() });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  };

  const handleClick = async (n: Notification) => {
    if (!n.readAt) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x));
      await fetch(`${BASE}/api/notifications/read-all`, { method: "POST", headers: authHeaders() });
    }
    setLocation(`/cars/${n.carId}`);
  };

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black uppercase flex items-center gap-3">
            <Bell className="w-8 h-8" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-black text-white text-base font-black px-2.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-2"
            >
              <CheckCheck className="w-5 h-5" />
              {markingAll ? "..." : "MARK ALL READ"}
            </Button>
          )}
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-400 font-bold text-lg">Loading…</div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-16 border-4 border-dashed border-gray-300 rounded-xl">
            <Bell className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-xl font-black text-gray-500 uppercase">No notifications</p>
            <p className="text-gray-400 font-medium mt-2">Changes to linked vehicles will appear here.</p>
          </div>
        )}

        <div className="space-y-3">
          {notifications.map(n => {
            const isUnread = !n.readAt;
            const carLabel = n.carYear && n.carMake && n.carModel
              ? `${n.carYear} ${n.carMake} ${n.carModel}`
              : "Vehicle";
            return (
              <div
                key={n.id}
                className={`flex items-stretch rounded-xl border-4 overflow-hidden cursor-pointer transition-all ${
                  isUnread
                    ? "border-black bg-white shadow-brutal hover:bg-gray-50"
                    : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                }`}
                onClick={() => handleClick(n)}
              >
                {isUnread && (
                  <div className="w-1.5 bg-black shrink-0" />
                )}
                <div className="flex items-start gap-4 p-4 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-black uppercase truncate ${isUnread ? "text-black" : "text-gray-600"}`}>
                        {carLabel}
                      </span>
                      <span className="text-xs text-gray-400 font-bold shrink-0">{formatTime(n.createdAt)}</span>
                    </div>
                    <p className={`text-base leading-snug ${isUnread ? "font-bold text-black" : "font-medium text-gray-600"}`}>
                      {n.message}
                    </p>
                    {n.actorName && (
                      <p className="text-xs text-gray-400 font-medium mt-1">by {n.actorName}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={e => handleDismiss(n.id, e)}
                  className="shrink-0 flex items-center justify-center w-12 border-l-2 border-current border-opacity-20 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Dismiss"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
