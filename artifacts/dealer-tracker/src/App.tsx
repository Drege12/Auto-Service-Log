import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CarsList from "@/pages/cars-list";
import CarDetail from "@/pages/car-detail";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { setMechanicId } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function getMechanicSession(): { mechanicId: number; username: string; displayName: string; isAdmin: boolean } | null {
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [session, setSession] = useState<{ mechanicId: number; username: string; displayName: string; isAdmin: boolean } | null>(
    () => getMechanicSession()
  );

  useEffect(() => {
    if (session) {
      setMechanicId(session.mechanicId);
    } else {
      setMechanicId(null);
    }
  }, [session]);

  const handleLogin = (mechanicId: number, username: string, displayName: string, isAdmin: boolean) => {
    const s = { mechanicId, username, displayName, isAdmin };
    localStorage.setItem("dt_mechanic", JSON.stringify(s));
    setMechanicId(mechanicId);
    setSession(s);
  };

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
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
