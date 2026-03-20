import { Link, useLocation } from "wouter";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-40 w-full border-b-4 border-black bg-white">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity tap-target">
            <div className="bg-black text-white p-2 rounded-lg shadow-brutal-sm">
              <Wrench className="w-8 h-8" />
            </div>
            <span className="text-2xl font-black uppercase tracking-tight hidden sm:inline-block">
              Dealer Tracker
            </span>
          </Link>
          
          <nav className="flex items-center gap-4">
            <Link 
              href="/" 
              className={cn(
                "font-bold text-lg px-4 py-2 border-2 border-transparent hover:border-black transition-all tap-target flex items-center rounded-md",
                location === "/" ? "bg-black text-white border-black shadow-brutal-sm" : ""
              )}
            >
              CARS
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
