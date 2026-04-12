import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Printer, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StatRow {
  year: string | null;
  make: string | null;
  model: string | null;
  description: string;
  entryCount: number;
  totalHours: number | null;
  avgHours: number | null;
  totalCost: number | null;
  avgCost: number | null;
}

interface VehicleGroup {
  key: string;
  year: string;
  make: string;
  model: string;
  tasks: StatRow[];
  totalEntries: number;
  totalHours: number;
  totalCost: number;
}

function fmt(n: number | null, decimals = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(decimals);
}

function fmtMoney(n: number | null): string {
  if (n == null || isNaN(n)) return "—";
  return "$" + n.toFixed(2);
}

function getMechanicSession() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    return JSON.parse(raw) as { mechanicId: number; isAdmin: boolean; adminMode?: boolean };
  } catch { return null; }
}

export default function StatsPage() {
  const [, navigate] = useLocation();
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const session = getMechanicSession();

  useEffect(() => {
    if (!session?.adminMode) { navigate("/"); return; }
    fetch(`${BASE}/api/admin/stats`, {
      headers: { "X-Mechanic-Id": String(session.mechanicId) },
    })
      .then(r => r.json())
      .then((data: StatRow[]) => { setRows(data); setLoading(false); })
      .catch(() => { setError("Failed to load statistics."); setLoading(false); });
  }, []);

  const groups: VehicleGroup[] = (() => {
    const map = new Map<string, VehicleGroup>();
    for (const r of rows) {
      const year = r.year || "Unknown";
      const make = r.make || "Unknown";
      const model = r.model || "Unknown";
      const key = `${year}||${make}||${model}`;
      if (!map.has(key)) {
        map.set(key, { key, year, make, model, tasks: [], totalEntries: 0, totalHours: 0, totalCost: 0 });
      }
      const g = map.get(key)!;
      g.tasks.push(r);
      g.totalEntries += r.entryCount;
      g.totalHours += r.totalHours ?? 0;
      g.totalCost += r.totalCost ?? 0;
    }
    return Array.from(map.values());
  })();

  const q = search.toLowerCase().trim();
  const filtered = q
    ? groups.filter(g =>
        `${g.year} ${g.make} ${g.model}`.toLowerCase().includes(q) ||
        g.tasks.some(t => t.description.toLowerCase().includes(q))
      ).map(g => ({
        ...g,
        tasks: q ? g.tasks.filter(t =>
          `${g.year} ${g.make} ${g.model}`.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        ) : g.tasks,
      }))
    : groups;

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(filtered.map(g => g.key)));
  const collapseAll = () => setExpanded(new Set());

  const handlePrint = () => {
    expandAll();
    setTimeout(() => window.print(), 150);
  };

  if (!session?.adminMode) return null;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #stats-printable, #stats-printable * { visibility: visible !important; }
          #stats-printable { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-expanded { display: table-row !important; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Maintenance Statistics</h1>
          <p className="text-muted-foreground font-medium mt-1">Aggregated by vehicle — useful for building a maintenance guide</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 bg-black text-white font-black px-5 py-3 rounded-lg border-2 border-black hover:bg-white hover:text-black transition-all text-base"
        >
          <Printer className="w-5 h-5" />
          PRINT
        </button>
      </div>

      {/* Search + expand controls */}
      <div className="flex items-center gap-3 mb-4 no-print">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search make, model, or task…"
            className="pl-9 bg-white text-black border-2 border-black"
          />
        </div>
        <button type="button" onClick={expandAll} className="text-sm font-bold underline">Expand all</button>
        <button type="button" onClick={collapseAll} className="text-sm font-bold underline">Collapse all</button>
      </div>

      {loading && <p className="text-center font-bold py-12">Loading…</p>}
      {error && <p className="text-center text-red-600 font-bold py-12">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-center font-bold py-12 text-muted-foreground">No maintenance data found.</p>
      )}

      <div id="stats-printable" className="space-y-4">
        {/* Print header (only visible when printing) */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-black uppercase">Maintenance Statistics Report</h1>
          <p className="text-sm text-gray-500">Printed {new Date().toLocaleDateString()}</p>
        </div>

        {filtered.map(group => {
          const isOpen = expanded.has(group.key);
          return (
            <div key={group.key} className="bg-white border-2 border-black rounded-lg overflow-hidden">
              {/* Vehicle header row */}
              <button
                type="button"
                onClick={() => toggle(group.key)}
                className="no-print w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="w-5 h-5 shrink-0" /> : <ChevronRight className="w-5 h-5 shrink-0" />}
                  <span className="text-xl font-black uppercase">{group.year} {group.make} {group.model}</span>
                </div>
              </button>

              {/* Print-always vehicle header */}
              <div className="hidden print:flex items-center justify-between px-5 py-3 border-b-2 border-black bg-gray-100">
                <span className="text-lg font-black uppercase">{group.year} {group.make} {group.model}</span>
              </div>

              {/* Task breakdown table */}
              {(isOpen || true) && (
                <div className={isOpen ? "block" : "hidden print:block"}>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-t-2 border-black">
                      <tr>
                        <th className="text-left px-5 py-2 font-black uppercase text-xs">Task / Description</th>
                        <th className="text-right px-3 py-2 font-black uppercase text-xs">Times</th>
                        <th className="text-right px-3 py-2 font-black uppercase text-xs">Avg Hours</th>
                        <th className="text-right px-3 py-2 font-black uppercase text-xs">Total Hours</th>
                        <th className="text-right px-3 py-2 font-black uppercase text-xs">Avg Cost</th>
                        <th className="text-right px-5 py-2 font-black uppercase text-xs">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tasks.map((task, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-5 py-2 font-medium">{task.description}</td>
                          <td className="px-3 py-2 text-right font-bold">{task.entryCount}</td>
                          <td className="px-3 py-2 text-right text-blue-700">{fmt(task.avgHours)}</td>
                          <td className="px-3 py-2 text-right text-blue-700 font-bold">{fmt(task.totalHours)}</td>
                          <td className="px-3 py-2 text-right text-green-700">{fmtMoney(task.avgCost)}</td>
                          <td className="px-5 py-2 text-right text-green-700 font-bold">{fmtMoney(task.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
