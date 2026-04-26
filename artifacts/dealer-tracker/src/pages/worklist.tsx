import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { ClipboardList, AlertTriangle, ChevronRight, Car, Truck, Anchor, Bike, RefreshCw, Clock, Calendar, Pencil, Check, X } from "lucide-react";
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
  carType: string | null;
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

type TimelineEntry = {
  id: number;
  carId: number;
  date: string;
  description: string;
  technician: string | null;
  hours: number | null;
  cost: number | null;
  notes: string | null;
  car: {
    year: number;
    make: string;
    model: string;
    stockNumber: string | null;
    carType: string | null;
    isLinkedCar: boolean;
    sold: boolean;
  } | null;
};

export default function WorklistPage() {
  const [view, setView] = useState<"pending" | "timeline">(() => {
    try {
      const raw = sessionStorage.getItem("dt_worklist_view");
      if (raw === "pending" || raw === "timeline") return raw;
    } catch { /* ignore */ }
    return "pending";
  });
  useEffect(() => {
    try { sessionStorage.setItem("dt_worklist_view", view); } catch { /* ignore */ }
  }, [view]);

  const [data, setData] = useState<Worklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Priority | "all">("all");
  type Category = "all" | "work" | "personal" | "clients";
  const [category, setCategory] = useState<Category>(() => {
    try {
      const raw = sessionStorage.getItem("dt_worklist_category");
      if (raw === "all" || raw === "work" || raw === "personal" || raw === "clients") return raw;
    } catch { /* ignore */ }
    return "all";
  });
  useEffect(() => {
    try { sessionStorage.setItem("dt_worklist_category", category); } catch { /* ignore */ }
  }, [category]);
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

  const inCategory = (g: WorklistGroup, cat: Category) => {
    if (cat === "all") return true;
    if (cat === "clients") return g.isLinkedCar === true;
    if (cat === "personal") return g.carType === "personal" && !g.isLinkedCar;
    // "work" = dealer (or unset) and not a linked client car
    return (g.carType === "dealer" || !g.carType) && !g.isLinkedCar;
  };

  const categoryCounts = useMemo(() => {
    const empty = { all: 0, work: 0, personal: 0, clients: 0 };
    if (!data) return empty;
    return data.groups.reduce((acc, g) => {
      acc.all += g.counts.total;
      if (inCategory(g, "work")) acc.work += g.counts.total;
      if (inCategory(g, "personal")) acc.personal += g.counts.total;
      if (inCategory(g, "clients")) acc.clients += g.counts.total;
      return acc;
    }, { ...empty });
  }, [data]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const inCat = data.groups.filter(g => inCategory(g, category));
    if (filter === "all") return inCat;
    return inCat
      .map(g => ({ ...g, todos: g.todos.filter(t => t.priority === filter) }))
      .filter(g => g.todos.length > 0);
  }, [data, filter, category]);


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
              <p className="text-gray-700 font-medium">
                {view === "pending"
                  ? "Everything that needs to be done — sorted by priority."
                  : "Hours and work logged across your vehicles."}
              </p>
            </div>
          </div>
          {view === "pending" && (
            <Button type="button" variant="outline" size="lg" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("w-5 h-5 mr-2", loading && "animate-spin")} /> REFRESH
            </Button>
          )}
        </div>

        {/* View switcher */}
        <div className="flex gap-2">
          {([
            { key: "pending", label: "Pending", Icon: ClipboardList },
            { key: "timeline", label: "Timeline", Icon: Clock },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "flex-1 sm:flex-none px-5 py-3 rounded-xl border-4 border-black font-black uppercase text-sm sm:text-base tracking-wide transition-all flex items-center justify-center gap-2",
                view === key ? "bg-orange-600 text-white shadow-brutal" : "bg-white text-black hover:bg-gray-100"
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        {view === "pending" && (
          <>
            {/* Category tabs */}
            {data && data.totals.all > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {([
                  { key: "all", label: "All" },
                  { key: "work", label: "Work" },
                  { key: "personal", label: "Personal" },
                  { key: "clients", label: "Clients" },
                ] as const).map(({ key, label }) => {
                  const count = categoryCounts[key];
                  const isActive = category === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key)}
                      className={cn(
                        "shrink-0 px-4 py-2 rounded-lg font-black uppercase text-sm tracking-wide border-4 border-black transition-all flex items-center gap-2",
                        isActive ? "bg-black text-white shadow-brutal-sm" : "bg-white text-black hover:bg-gray-100"
                      )}
                    >
                      <span>{label}</span>
                      <span className={cn("px-2 py-0.5 rounded text-xs font-black", isActive ? "bg-white text-black" : "bg-gray-200 text-black")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Priority totals + filters */}
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

            {loading && <div className="p-12 text-center text-2xl font-bold text-gray-500">Loading worklist...</div>}

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
                No matching items.
              </div>
            )}

            {!loading && !error && filteredGroups.map(g => {
              const VIcon = vehicleIcon(g.vehicleType);
              const headerColor =
                g.maxPriority === "high" ? "bg-red-50 border-red-600"
                : g.maxPriority === "medium" ? "bg-yellow-50 border-yellow-600"
                : "bg-gray-50 border-gray-500";
              return (
                <section key={g.carId} className={cn("border-4 border-black rounded-2xl bg-white shadow-brutal overflow-hidden")}>
                  <Link href={`/cars/${g.carId}`} className={cn("flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b-4 border-black hover:opacity-95 transition-opacity", headerColor)}>
                    <div className="shrink-0 w-12 h-12 bg-white rounded-lg border-2 border-black flex items-center justify-center shadow-brutal-sm">
                      <VIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl sm:text-2xl font-black uppercase truncate">{g.year} {g.make} {g.model}</span>
                        {g.stockNumber && <span className="bg-black text-white text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest">#{g.stockNumber}</span>}
                        {g.isLinkedCar && <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest">Client</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-gray-700 mt-0.5">
                        {g.color && <span>{g.color}</span>}
                        {g.ownerName && <span className="text-gray-500">• {g.ownerName}</span>}
                        <span className="ml-auto flex items-center gap-1.5">
                          {g.counts.high > 0 && <span className="flex items-center gap-1"><span className={cn("w-2 h-2 rounded-full", PRI_DOT.high)} />{g.counts.high}</span>}
                          {g.counts.medium > 0 && <span className="flex items-center gap-1"><span className={cn("w-2 h-2 rounded-full", PRI_DOT.medium)} />{g.counts.medium}</span>}
                          {g.counts.low > 0 && <span className="flex items-center gap-1"><span className={cn("w-2 h-2 rounded-full", PRI_DOT.low)} />{g.counts.low}</span>}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 shrink-0 text-black" />
                  </Link>
                  <ul className="divide-y-2 divide-gray-200">
                    {g.todos.map(t => (
                      <li key={t.id} className="px-4 sm:px-5 py-3 flex items-start gap-3 hover:bg-gray-50">
                        <span className={cn("shrink-0 mt-1 px-2 py-0.5 rounded font-black uppercase text-[11px] border-2", PRI_BADGE[t.priority])}>{t.priority}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-base sm:text-lg font-bold text-black break-words">{t.description}</div>
                          {t.notes && <div className="text-sm text-gray-600 font-medium mt-0.5 break-words whitespace-pre-wrap">{t.notes}</div>}
                        </div>
                        <Link href={`/cars/${g.carId}`} className="shrink-0 text-xs font-black uppercase text-black border-2 border-black rounded px-2 py-1 hover:bg-black hover:text-white transition-colors">Open</Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}

        {view === "timeline" && <TimelineView mechanicId={mechanicId} />}
      </div>
    </Layout>
  );
}

// ============================================================================
// Timeline view: shows all maintenance entries with hour totals (today/week/
// month/year), date-range filtering, and inline hours editing.
// ============================================================================

type RangeKey = "today" | "week" | "month" | "year" | "all" | "custom";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d: Date) {
  // Week starts Monday
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x; }
function startOfYear(d: Date) { const x = startOfDay(d); x.setMonth(0,1); return x; }
function fmtYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function parseYMD(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
}
function fmtHours(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0";
  return (Math.round(n * 100) / 100).toString();
}
function fmtDateLong(s: string) {
  const d = parseYMD(s);
  if (!d) return s;
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function TimelineView({ mechanicId }: { mechanicId: number | null }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<RangeKey>(() => {
    try {
      const raw = sessionStorage.getItem("dt_worklist_timeline_range");
      if (raw === "today" || raw === "week" || raw === "month" || raw === "year" || raw === "all" || raw === "custom") return raw;
    } catch { /* ignore */ }
    return "week";
  });
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Inline edit state for hours
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    try { sessionStorage.setItem("dt_worklist_timeline_range", range); } catch { /* ignore */ }
  }, [range]);

  const load = async () => {
    if (!mechanicId) { setLoading(false); setError("Please log in."); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${BASE}/api/worklist/timeline`, {
        headers: { "X-Mechanic-Id": String(mechanicId) },
      });
      if (!r.ok) {
        if (r.status === 403) setError("Timeline isn't available for driver accounts.");
        else setError("Couldn't load the timeline. Please try again.");
        setEntries([]);
      } else {
        const json = await r.json();
        setEntries(json.entries || []);
      }
    } catch {
      setError("Network error — please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Compute totals for ALL ranges from full entry list (independent of filter)
  const allTotals = useMemo(() => {
    const now = new Date();
    const t0 = startOfDay(now);
    const w0 = startOfWeek(now);
    const m0 = startOfMonth(now);
    const y0 = startOfYear(now);
    let today = 0, week = 0, month = 0, year = 0, all = 0;
    let todayCount = 0, weekCount = 0, monthCount = 0, yearCount = 0;
    for (const e of entries) {
      const d = parseYMD(e.date);
      const h = e.hours ?? 0;
      all += h;
      if (!d) continue;
      if (d >= y0) { year += h; yearCount++; }
      if (d >= m0) { month += h; monthCount++; }
      if (d >= w0) { week += h; weekCount++; }
      if (d >= t0) { today += h; todayCount++; }
    }
    return {
      today: { hours: today, count: todayCount },
      week: { hours: week, count: weekCount },
      month: { hours: month, count: monthCount },
      year: { hours: year, count: yearCount },
      all: { hours: all, count: entries.length },
    };
  }, [entries]);

  // Apply selected range to produce visible list
  const visible = useMemo(() => {
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    switch (range) {
      case "today": from = startOfDay(now); break;
      case "week": from = startOfWeek(now); break;
      case "month": from = startOfMonth(now); break;
      case "year": from = startOfYear(now); break;
      case "all": from = null; break;
      case "custom":
        from = customFrom ? parseYMD(customFrom) : null;
        to = customTo ? parseYMD(customTo) : null;
        break;
    }
    return entries.filter(e => {
      const d = parseYMD(e.date);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [entries, range, customFrom, customTo]);

  const visibleTotals = useMemo(() => {
    let h = 0;
    for (const e of visible) h += e.hours ?? 0;
    return { hours: h, count: visible.length };
  }, [visible]);

  // Group visible entries by date
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const e of visible) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] < b[0] ? 1 : -1);
  }, [visible]);

  const startEdit = (e: TimelineEntry) => {
    setEditingId(e.id);
    setEditValue(e.hours != null ? String(e.hours) : "");
    setSaveError("");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setSaveError("");
  };
  const saveEdit = async (e: TimelineEntry) => {
    const trimmed = editValue.trim();
    let newHours: number | null = null;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        setSaveError("Enter a number 0 or greater.");
        return;
      }
      newHours = n;
    }
    if (!mechanicId) { setSaveError("Please log in."); return; }
    setSavingId(e.id);
    setSaveError("");
    try {
      const r = await fetch(`${BASE}/api/cars/${e.carId}/maintenance/${e.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Mechanic-Id": String(mechanicId) },
        body: JSON.stringify({
          date: e.date,
          description: e.description,
          technician: e.technician,
          hours: newHours,
          cost: e.cost,
          notes: e.notes,
        }),
      });
      if (!r.ok) {
        setSaveError("Save failed. Please try again.");
        return;
      }
      const updated = await r.json();
      setEntries(prev => prev.map(x => x.id === e.id ? { ...x, hours: updated.hours ?? null } : x));
      cancelEdit();
    } catch {
      setSaveError("Network error — please retry.");
    } finally {
      setSavingId(null);
    }
  };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "all", label: "All Time" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-5">
      {/* Hour totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { key: "today" as RangeKey, label: "Today", t: allTotals.today },
          { key: "week" as RangeKey, label: "This Week", t: allTotals.week },
          { key: "month" as RangeKey, label: "This Month", t: allTotals.month },
          { key: "year" as RangeKey, label: "This Year", t: allTotals.year },
          { key: "all" as RangeKey, label: "All Time", t: allTotals.all },
        ]).map(({ key, label, t }) => {
          const isActive = range === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                "border-4 rounded-xl p-3 sm:p-4 text-left transition-all shadow-brutal-sm",
                isActive ? "bg-orange-600 text-white border-orange-700 ring-4 ring-offset-2 ring-black scale-[1.02]" : "bg-white text-black border-black hover:bg-gray-50"
              )}
            >
              <div className="text-3xl sm:text-4xl font-black leading-none">{fmtHours(t.hours)}<span className="text-base sm:text-lg ml-1">h</span></div>
              <div className="text-xs sm:text-sm font-black uppercase mt-1 tracking-wider">{label}</div>
              <div className={cn("text-[11px] font-bold uppercase mt-0.5", isActive ? "text-white/80" : "text-gray-500")}>{t.count} {t.count === 1 ? "entry" : "entries"}</div>
            </button>
          );
        })}
      </div>

      {/* Range chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={cn(
              "shrink-0 px-3 py-2 rounded-lg font-black uppercase text-xs sm:text-sm tracking-wide border-2 border-black transition-all flex items-center gap-1.5",
              range === key ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
            )}
          >
            {key === "custom" ? <Calendar className="w-4 h-4" /> : null}
            {label}
          </button>
        ))}
      </div>

      {/* Custom range inputs */}
      {range === "custom" && (
        <div className="flex flex-wrap items-center gap-3 p-3 border-2 border-black rounded-lg bg-white">
          <label className="flex items-center gap-2 text-sm font-bold">
            From
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border-2 border-black rounded px-2 py-1 font-bold" />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            To
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border-2 border-black rounded px-2 py-1 font-bold" />
          </label>
          {(customFrom || customTo) && (
            <button type="button" onClick={() => { setCustomFrom(""); setCustomTo(""); }} className="text-sm font-black uppercase border-2 border-black rounded px-2 py-1 hover:bg-black hover:text-white">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Range total + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Showing {visibleTotals.count} {visibleTotals.count === 1 ? "entry" : "entries"} • <span className="text-black">{fmtHours(visibleTotals.hours)} hours</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} /> REFRESH
        </Button>
      </div>

      {loading && <div className="p-12 text-center text-2xl font-bold text-gray-500">Loading timeline...</div>}

      {error && (
        <div className="p-6 border-4 border-red-600 bg-red-50 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-700" />
          <span className="font-bold text-red-700">{error}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 border-2 border-red-600 bg-red-50 rounded-lg text-sm font-bold text-red-700">{saveError}</div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div className="p-12 border-4 border-dashed border-gray-400 rounded-2xl text-center">
          <h3 className="text-2xl font-black text-gray-500 uppercase">No work logged in this range.</h3>
          <p className="mt-2 text-lg text-gray-500">Try a wider date range, or log work from a vehicle's Maintenance tab.</p>
        </div>
      )}

      {!loading && !error && grouped.map(([date, list]) => {
        const dayHours = list.reduce((s, e) => s + (e.hours ?? 0), 0);
        return (
          <section key={date} className="border-4 border-black rounded-2xl bg-white shadow-brutal overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b-4 border-black bg-orange-50">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-5 h-5 shrink-0" />
                <span className="text-lg sm:text-xl font-black uppercase truncate">{fmtDateLong(date)}</span>
              </div>
              <span className="shrink-0 bg-black text-white text-sm font-black px-3 py-1 rounded-lg">
                {fmtHours(dayHours)}h • {list.length}
              </span>
            </div>
            <ul className="divide-y-2 divide-gray-200">
              {list.map(e => (
                <li key={e.id} className="px-4 sm:px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-base sm:text-lg font-bold text-black break-words">{e.description}</div>
                      {e.car && (
                        <Link href={`/cars/${e.carId}`} className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-gray-700 mt-0.5 hover:underline">
                          {e.car.year} {e.car.make} {e.car.model}
                          {e.car.stockNumber && <span className="bg-gray-200 px-1.5 py-0.5 rounded text-[10px] font-black">#{e.car.stockNumber}</span>}
                          {e.car.isLinkedCar && <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[10px] font-black">CLIENT</span>}
                          {e.car.sold && <span className="bg-gray-700 text-white px-1.5 py-0.5 rounded text-[10px] font-black">SOLD</span>}
                        </Link>
                      )}
                      {e.technician && (
                        <div className="text-xs font-bold text-gray-500 mt-0.5">By {e.technician}</div>
                      )}
                      {e.notes && (
                        <div className="text-sm text-gray-600 font-medium mt-1 break-words whitespace-pre-wrap">{e.notes}</div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1 min-w-[110px]">
                      {editingId === e.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.25"
                            min="0"
                            autoFocus
                            value={editValue}
                            onChange={ev => setEditValue(ev.target.value)}
                            onKeyDown={ev => {
                              if (ev.key === "Enter") saveEdit(e);
                              if (ev.key === "Escape") cancelEdit();
                            }}
                            className="w-20 border-2 border-black rounded px-2 py-1 font-bold text-right"
                          />
                          <span className="text-sm font-black">h</span>
                          <button type="button" onClick={() => saveEdit(e)} disabled={savingId === e.id} className="bg-green-600 text-white border-2 border-black rounded p-1 hover:bg-green-700 disabled:opacity-50">
                            <Check className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={cancelEdit} className="bg-white text-black border-2 border-black rounded p-1 hover:bg-gray-100">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEdit(e)} className="group flex items-center gap-1 border-2 border-black rounded px-2 py-1 hover:bg-orange-50" title="Edit hours">
                          <Clock className="w-4 h-4" />
                          <span className="font-black">{e.hours != null ? `${fmtHours(e.hours)}h` : "—"}</span>
                          <Pencil className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
