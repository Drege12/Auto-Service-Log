import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { ClipboardList, AlertTriangle, ChevronRight, Car, Truck, Anchor, Bike, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Priority = "high" | "medium" | "low";

type WorklistTodo = {
  id: number;
  description: string;
  priority: Priority;
  notes: string | null;
};

type WorklistGroup = {
  carId: number;
  year: number;
  make: string;
  model: string;
  stockNumber: string | null;
  color: string | null;
  vehicleType: string | null;
  isLinkedCar: boolean;
  ownerName: string | null;
  maxPriority: Priority;
  counts: { high: number; medium: number; low: number; total: number };
  todos: WorklistTodo[];
};

type Worklist = {
  groups: WorklistGroup[];
  totals: { high: number; medium: number; low: number; all: number };
};

function getMechanicId(): number | null {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    return JSON.parse(raw)?.mechanicId ?? null;
  } catch { return null; }
}

const PRI_BADGE: Record<Priority, string> = {
  high: "bg-red-600 text-white border-red-700",
  medium: "bg-yellow-500 text-black border-yellow-600",
  low: "bg-gray-400 text-white border-gray-500",
};

const PRI_DOT: Record<Priority, string> = {
  high: "bg-red-600",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

function vehicleIcon(type: string | null) {
  switch ((type ?? "").toLowerCase()) {
    case "powersports":
    case "motorcycle": return Bike;
    case "marine":
    case "boat": return Anchor;
    case "commercial":
    case "truck":
    case "rv": return Truck;
    default: return Car;
  }
}

export default function WorklistPage() {
  const [data, setData] = useState<Worklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Priority | "all">("all");
  const mechanicId = getMechanicId();

  const fetchData = async () => {
    if (!mechanicId) { setLoading(false); setError("Please log in."); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${BASE}/api/worklist`, {
        headers: { "X-Mechanic-Id": String(mechanicId) },
      });
      if (!r.ok) {
        if (r.status === 403) setError("The worklist isn't available for driver accounts.");
        else setError("Couldn't load the worklist. Please try again.");
        setData(null);
      } else {
        setData(await r.json());
      }
    } catch {
      setError("Network error — please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.groups;
    return data.groups
      .map(g => ({ ...g, todos: g.todos.filter(t => t.priority === filter) }))
      .filter(g => g.todos.length > 0);
  }, [data, filter]);

  return (
    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-orange-50 via-red-50 to-rose-50 px-5 py-5 rounded-xl border-4 border-black shadow-brutal">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-orange-600 text-white rounded-xl flex items-center justify-center border-2 border-black shadow-brutal-sm">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase leading-tight">Worklist</h1>
            <p className="text-gray-700 font-medium">Everything that needs to be done — sorted by priority.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="lg" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn("w-5 h-5 mr-2", loading && "animate-spin")} /> REFRESH
        </Button>
      </div>

      {/* Totals + filters */}
      {data && data.totals.all > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["all", "high", "medium", "low"] as const).map(key => {
            const count = key === "all" ? data.totals.all : data.totals[key];
            const isActive = filter === key;
            const colorClass =
              key === "high" ? "bg-red-600 text-white border-red-700"
              : key === "medium" ? "bg-yellow-500 text-black border-yellow-600"
              : key === "low" ? "bg-gray-400 text-white border-gray-500"
              : "bg-black text-white border-black";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "border-4 rounded-xl p-3 sm:p-4 text-left transition-all shadow-brutal-sm",
                  isActive ? `${colorClass} ring-4 ring-offset-2 ring-black scale-[1.02]` : "bg-white text-black border-black hover:bg-gray-50"
                )}
              >
                <div className="text-3xl sm:text-4xl font-black leading-none">{count}</div>
                <div className="text-xs sm:text-sm font-black uppercase mt-1 tracking-wider">
                  {key === "all" ? "Total" : `${key} priority`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="p-12 text-center text-2xl font-bold text-gray-500">Loading worklist...</div>
      )}

      {error && (
        <div className="p-6 border-4 border-red-600 bg-red-50 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-700" />
          <span className="font-bold text-red-700">{error}</span>
        </div>
      )}

      {!loading && !error && data && data.totals.all === 0 && (
        <div className="p-12 border-4 border-dashed border-gray-400 rounded-2xl text-center">
          <h3 className="text-2xl font-black text-gray-500 uppercase">All caught up!</h3>
          <p className="mt-2 text-lg text-gray-500">There's nothing pending across your vehicles.</p>
        </div>
      )}

      {!loading && !error && filteredGroups.length === 0 && data && data.totals.all > 0 && (
        <div className="p-8 border-4 border-dashed border-gray-300 rounded-xl text-center text-gray-500 font-bold">
          No {filter} priority items.
        </div>
      )}

      {/* Grouped car cards */}
      {!loading && !error && filteredGroups.map(g => {
        const VIcon = vehicleIcon(g.vehicleType);
        const headerColor =
          g.maxPriority === "high" ? "bg-red-50 border-red-600"
          : g.maxPriority === "medium" ? "bg-yellow-50 border-yellow-600"
          : "bg-gray-50 border-gray-500";
        return (
          <section
            key={g.carId}
            className={cn("border-4 border-black rounded-2xl bg-white shadow-brutal overflow-hidden")}
          >
            <Link
              href={`/cars/${g.carId}`}
              className={cn(
                "flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b-4 border-black hover:opacity-95 transition-opacity",
                headerColor
              )}
            >
              <div className="shrink-0 w-12 h-12 bg-white rounded-lg border-2 border-black flex items-center justify-center shadow-brutal-sm">
                <VIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black uppercase truncate">
                    {g.year} {g.make} {g.model}
                  </span>
                  {g.stockNumber && (
                    <span className="bg-black text-white text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest">
                      #{g.stockNumber}
                    </span>
                  )}
                  {g.isLinkedCar && (
                    <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest">
                      Client
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-gray-700 mt-0.5">
                  {g.color && <span>{g.color}</span>}
                  {g.ownerName && <span className="text-gray-500">• {g.ownerName}</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    {g.counts.high > 0 && (
                      <span className="flex items-center gap-1">
                        <span className={cn("w-2 h-2 rounded-full", PRI_DOT.high)} />
                        {g.counts.high}
                      </span>
                    )}
                    {g.counts.medium > 0 && (
                      <span className="flex items-center gap-1">
                        <span className={cn("w-2 h-2 rounded-full", PRI_DOT.medium)} />
                        {g.counts.medium}
                      </span>
                    )}
                    {g.counts.low > 0 && (
                      <span className="flex items-center gap-1">
                        <span className={cn("w-2 h-2 rounded-full", PRI_DOT.low)} />
                        {g.counts.low}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 shrink-0 text-black" />
            </Link>

            <ul className="divide-y-2 divide-gray-200">
              {g.todos.map(t => (
                <li key={t.id} className="px-4 sm:px-5 py-3 flex items-start gap-3 hover:bg-gray-50">
                  <span className={cn("shrink-0 mt-1 px-2 py-0.5 rounded font-black uppercase text-[11px] border-2", PRI_BADGE[t.priority])}>
                    {t.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-base sm:text-lg font-bold text-black break-words">{t.description}</div>
                    {t.notes && (
                      <div className="text-sm text-gray-600 font-medium mt-0.5 break-words whitespace-pre-wrap">{t.notes}</div>
                    )}
                  </div>
                  <Link
                    href={`/cars/${g.carId}`}
                    className="shrink-0 text-xs font-black uppercase text-black border-2 border-black rounded px-2 py-1 hover:bg-black hover:text-white transition-colors"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
    </Layout>
  );
}
