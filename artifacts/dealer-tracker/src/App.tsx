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
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import AdminLoginPage from "@/pages/admin-login";
import { setMechanicId } from "@workspace/api-client-react";

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
};

function getMechanicSession(): Session | null {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.mechanicId) return parsed;
    return null;
  } catch {
    return null;
  }
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(() => getMechanicSession());
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    if (session) {
      setMechanicId(session.mechanicId);
    } else {
      setMechanicId(null);
    }
  }, [session]);

  const handleLogin = (mechanicId: number, username: string, displayName: string, isAdmin: boolean, role?: string) => {
    const s: Session = { mechanicId, username, displayName, isAdmin, adminMode: false, role: role ?? "mechanic" };
    localStorage.setItem("dt_mechanic", JSON.stringify(s));
    setMechanicId(mechanicId);
    setSession(s);
  };

  const handleAdminLogin = (mechanicId: number, username: string, displayName: string) => {
    const s: Session = { mechanicId, username, displayName, isAdmin: true, adminMode: true };
    localStorage.setItem("dt_mechanic", JSON.stringify(s));
    setMechanicId(mechanicId);
    setSession(s);
    setShowAdminLogin(false);
  };

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
        onAdminAccess={() => setShowAdminLogin(true)}
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
