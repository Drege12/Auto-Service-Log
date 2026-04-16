import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Wrench, LogOut, Users, UserCircle, BarChart2, MessageSquare, Bell, Home, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { setMechanicId } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getMechanicSession(): { mechanicId: number | null; displayName: string; isAdmin: boolean; adminMode: boolean; role: string } {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return { mechanicId: null, displayName: "", isAdmin: false, adminMode: false, role: "mechanic" };
    const parsed = JSON.parse(raw);
    return {
      mechanicId: parsed?.mechanicId ?? null,
      displayName: parsed?.displayName || parsed?.username || "",
      isAdmin: parsed?.isAdmin === true,
      adminMode: parsed?.adminMode === true,
      role: parsed?.role ?? "mechanic",
    };
  } catch {
    return { mechanicId: null, displayName: "", isAdmin: false, adminMode: false, role: "mechanic" };
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { mechanicId, displayName, isAdmin, adminMode, role } = getMechanicSession();
  const isDriver = role === "driver";
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    if (!mechanicId) return;
    const fetchUnread = async () => {
      try {
        const headers = { "X-Mechanic-Id": String(mechanicId) };
        const [dmRes, groupRes] = await Promise.all([
          fetch(`${BASE}/api/messages/unread-count`, { headers }),
          fetch(`${BASE}/api/groups/unread-count`, { headers }),
        ]);
        const dmCount = dmRes.ok ? ((await dmRes.json()).count ?? 0) : 0;
        const groupCount = groupRes.ok ? ((await groupRes.json()).count ?? 0) : 0;
        setUnreadCount(dmCount + groupCount);
      } catch { /* ignore */ }
    };
    const fetchNotifCount = async () => {
      try {
        const r = await fetch(`${BASE}/api/notifications/unread-count`, {
          headers: { "X-Mechanic-Id": String(mechanicId) },
        });
        if (r.ok) {
          const data = await r.json();
          setUnreadNotifCount(data.count ?? 0);
        }
      } catch { /* ignore */ }
    };
    fetchUnread();
    fetchNotifCount();
    const iv1 = setInterval(fetchUnread, 15000);
    const iv2 = setInterval(fetchNotifCount, 15000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [mechanicId]);

  const handleLogout = () => {
    localStorage.removeItem("dt_mechanic");
    setMechanicId(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-40 w-full border-b-4 border-black bg-white">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity tap-target">
            <div className="bg-black text-white p-2 rounded-lg shadow-brutal-sm">
              <Wrench className="w-8 h-8" />
            </div>
            <span className="text-2xl font-black uppercase tracking-tight hidden sm:inline-block">
              Maintenance Tracker
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {displayName && (
              <span className="hidden lg:flex items-center gap-2 mr-2">
                {isAdmin && (
                  <span className="bg-amber-500 text-white font-black px-2 py-0.5 rounded text-xs uppercase tracking-widest">Admin</span>
                )}
                {!isAdmin && !isDriver && (
                  <span className="bg-blue-700 text-white font-black px-2 py-0.5 rounded text-xs uppercase tracking-widest">Technician</span>
                )}
                {isDriver && (
                  <span className="bg-teal-600 text-white font-black px-2 py-0.5 rounded text-xs uppercase tracking-widest">Driver</span>
                )}
                <span className="text-sm font-black uppercase text-muted-foreground">{displayName}</span>
              </span>
            )}
            {adminMode && (
              <Link
                href="/admin"
                className={cn(
                  "font-bold px-2 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center justify-center gap-1.5 rounded-md",
                  location === "/admin" ? "bg-amber-500 text-white border-amber-500 shadow-brutal-sm" : ""
                )}
              >
                <Users className="w-5 h-5 shrink-0" />
                <span className="hidden md:inline text-sm">ACCOUNTS</span>
              </Link>
            )}
            {adminMode && (
              <Link
                href="/stats"
                className={cn(
                  "font-bold px-2 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center justify-center gap-1.5 rounded-md",
                  location === "/stats" ? "bg-blue-600 text-white border-blue-600 shadow-brutal-sm" : ""
                )}
              >
                <BarChart2 className="w-5 h-5 shrink-0" />
                <span className="hidden md:inline text-sm">STATS</span>
              </Link>
            )}
            <Link
              href="/notifications"
              className={cn(
                "relative font-bold px-2 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center justify-center gap-1.5 rounded-md",
                location === "/notifications" ? "bg-black text-white border-black shadow-brutal-sm" : ""
              )}
            >
              <Bell className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline text-sm">ALERTS</span>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center leading-none">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </Link>
            <Link
              href="/messages"
              className={cn(
                "relative font-bold px-2 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center justify-center gap-1.5 rounded-md",
                location === "/messages" ? "bg-black text-white border-black shadow-brutal-sm" : ""
              )}
            >
              <MessageSquare className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline text-sm">MESSAGES</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Link
              href="/profile"
              className={cn(
                "font-bold px-2 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center justify-center gap-1.5 rounded-md",
                location === "/profile" ? "bg-black text-white border-black shadow-brutal-sm" : ""
              )}
            >
              <UserCircle className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline text-sm">PROFILE</span>
            </Link>
            {!isAdmin && (
              <Link
                href="/help"
                className={cn(
                  "font-bold px-2 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center justify-center gap-1.5 rounded-md",
                  location === "/help" ? "bg-teal-600 text-white border-teal-600 shadow-brutal-sm" : ""
                )}
              >
                <HelpCircle className="w-5 h-5 shrink-0" />
                <span className="hidden md:inline text-sm">HELP</span>
              </Link>
            )}
            <Link
              href="/"
              className={cn(
                "font-bold px-2 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center justify-center gap-1.5 rounded-md",
                location === "/" ? "bg-black text-white border-black shadow-brutal-sm" : ""
              )}
            >
              <Home className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline text-sm">HOME</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 font-bold px-2 py-2 border-2 border-black rounded-md hover:bg-black hover:text-white transition-all tap-target"
              title="Log out"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline text-sm">LOG OUT</span>
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
