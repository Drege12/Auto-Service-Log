import { Link, useLocation } from "wouter";
import { Wrench, LogOut, Users, UserCircle, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setMechanicId } from "@workspace/api-client-react";

function getMechanicSession(): { displayName: string; isAdmin: boolean; adminMode: boolean } {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return { displayName: "", isAdmin: false, adminMode: false };
    const parsed = JSON.parse(raw);
    return {
      displayName: parsed?.displayName || parsed?.username || "",
      isAdmin: parsed?.isAdmin === true,
      adminMode: parsed?.adminMode === true,
    };
  } catch {
    return { displayName: "", isAdmin: false, adminMode: false };
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { displayName, adminMode } = getMechanicSession();

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

          <nav className="flex items-center gap-3">
            {displayName && (
              <span className="flex items-center gap-2 hidden sm:flex">
                {isAdmin && (
                  <span className="bg-amber-500 text-white font-black px-2 py-0.5 rounded text-xs uppercase tracking-widest">Admin</span>
                )}
                <span className="text-sm font-black uppercase text-muted-foreground">{displayName}</span>
              </span>
            )}
            {adminMode && (
              <Link
                href="/admin"
                className={cn(
                  "font-bold text-lg px-4 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center gap-2 rounded-md",
                  location === "/admin" ? "bg-amber-500 text-white border-amber-500 shadow-brutal-sm" : ""
                )}
              >
                <Users className="w-5 h-5" />
                <span className="hidden sm:inline">ACCOUNTS</span>
              </Link>
            )}
            {adminMode && (
              <Link
                href="/stats"
                className={cn(
                  "font-bold text-lg px-4 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center gap-2 rounded-md",
                  location === "/stats" ? "bg-blue-600 text-white border-blue-600 shadow-brutal-sm" : ""
                )}
              >
                <BarChart2 className="w-5 h-5" />
                <span className="hidden sm:inline">STATS</span>
              </Link>
            )}
            <Link
              href="/profile"
              className={cn(
                "font-bold text-lg px-4 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center gap-2 rounded-md",
                location === "/profile" ? "bg-black text-white border-black shadow-brutal-sm" : ""
              )}
            >
              <UserCircle className="w-5 h-5" />
              <span className="hidden sm:inline">PROFILE</span>
            </Link>
            <Link
              href="/"
              className={cn(
                "font-bold text-lg px-4 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center rounded-md",
                location === "/" ? "bg-black text-white border-black shadow-brutal-sm" : ""
              )}
            >
              BACK
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 font-bold text-base px-4 py-2 border-2 border-black rounded-md hover:bg-black hover:text-white transition-all tap-target"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">LOG OUT</span>
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
