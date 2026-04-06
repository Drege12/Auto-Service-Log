import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CarsList from "@/pages/cars-list";
import CarDetail from "@/pages/car-detail";
import AdminPage from "@/pages/admin";
import StatsPage from "@/pages/stats";
import ProfilePage from "@/pages/profile";
import MessagesPage from "@/pages/messages";
import NotificationsPage from "@/pages/notifications";
import NotFound from "@/pages/not-found";
import HelpPage from "@/pages/help";
import LoginPage from "@/pages/login";
import AdminLoginPage from "@/pages/admin-login";
import { setMechanicId, setAuthTokenGetter } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

type Session = {
  mechanicId: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  adminMode?: boolean;
  role?: string;
  token: string;
};

function loadStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (parsed && parsed.mechanicId && parsed.token) return parsed as Session;
    return null;
  } catch {
    return null;
  }
}

function saveSession(s: Session) {
  localStorage.setItem("dt_mechanic", JSON.stringify(s));
}

function clearSession() {
  localStorage.removeItem("dt_mechanic");
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={CarsList} />
      <Route path="/cars/:id" component={CarDetail} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/help" component={HelpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [validating, setValidating] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(() => {
    return new URLSearchParams(window.location.search).has("admin");
  });

  useEffect(() => {
    const stored = loadStoredSession();
    if (!stored) {
      setValidating(false);
      return;
    }

    fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then(r => r.json())
      .then((data: { ok?: boolean; mechanicId?: number; username?: string; displayName?: string; isAdmin?: boolean; role?: string; error?: string }) => {
        if (data.ok && data.mechanicId) {
          const refreshed: Session = {
            ...stored,
            mechanicId: data.mechanicId,
            username: data.username ?? stored.username,
            displayName: data.displayName ?? stored.displayName,
            isAdmin: data.isAdmin ?? stored.isAdmin,
            role: data.role ?? stored.role,
          };
          saveSession(refreshed);
          applySession(refreshed);
          setSession(refreshed);
        } else {
          clearSession();
          setSession(null);
        }
      })
      .catch(() => {
        clearSession();
        setSession(null);
      })
      .finally(() => setValidating(false));
  }, []);

  function applySession(s: Session) {
    setMechanicId(s.mechanicId);
    setAuthTokenGetter(() => s.token);
  }

  function clearAppliedSession() {
    setMechanicId(null);
    setAuthTokenGetter(null);
  }

  const handleLogin = (mechanicId: number, username: string, displayName: string, isAdmin: boolean, role?: string, token?: string) => {
    const s: Session = { mechanicId, username, displayName, isAdmin, adminMode: false, role: role ?? "mechanic", token: token ?? "" };
    saveSession(s);
    applySession(s);
    setSession(s);
  };

  const handleAdminLogin = (mechanicId: number, username: string, displayName: string, token?: string) => {
    const s: Session = { mechanicId, username, displayName, isAdmin: true, adminMode: true, token: token ?? "" };
    saveSession(s);
    applySession(s);
    setSession(s);
    setShowAdminLogin(false);
  };

  const handleLogout = () => {
    clearSession();
    clearAppliedSession();
    setSession(null);
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-gray-500 font-bold uppercase tracking-wide animate-pulse">Checking session...</p>
      </div>
    );
  }

  if (!session) {
    if (showAdminLogin) {
      return (
        <AdminLoginPage
          onLogin={handleAdminLogin}
          onBack={() => setShowAdminLogin(false)}
        />
      );
    }
    return (
      <LoginPage
        onLogin={handleLogin}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
