import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CarsList from "@/pages/cars-list";
import CarDetail from "@/pages/car-detail";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

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
  const [authed, setAuthed] = useState(() => localStorage.getItem("dt_auth") === "1");

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
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
