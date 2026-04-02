import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListServiceIntervals,
  useCreateServiceInterval,
  useUpdateServiceInterval,
  useMarkServiceDone,
  useDeleteServiceInterval,
  type ServiceInterval,
} from "@workspace/api-client-react";
import { useListMileage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wrench, Plus, Trash2, CheckCircle, Pencil } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function defaultIntervalType(vehicleType?: string | null) {
  if (vehicleType === "boat") return "hours";
  if (vehicleType === "atv") return "seasonal";
  return "miles";
}

function readingUnit(vehicleType?: string | null) {
  return vehicleType === "boat" ? "hrs" : "mi";
}

function parseMonths(s: string | null | undefined): number[] {
  if (!s) return [];
  return s.split(",").map(Number).filter(n => n >= 1 && n <= 12);
}

function monthsToString(nums: number[]): string {
  return nums.sort((a, b) => a - b).join(",");
}

type DueStatus = "overdue" | "due-soon" | "ok" | "never-done";

function getDueStatus(
  interval: ServiceInterval,
  currentReading: number | null,
): { status: DueStatus; label: string; detail: string } {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (interval.intervalType === "seasonal") {
    const months = parseMonths(interval.targetMonths);
    if (months.length === 0) return { status: "never-done", label: "NOT SET", detail: "No target months configured." };

    const lastDate = interval.lastServiceDate ? new Date(interval.lastServiceDate) : null;

    // Find the next upcoming target month window
    let nearestDaysAway = Infinity;
    let nearestLabel = "";
    let overdue = false;

    for (const m of months) {
      const thisYear = new Date(today.getFullYear(), m - 1, 1);
      const nextYear = new Date(today.getFullYear() + 1, m - 1, 1);
      const candidate = thisYear >= today ? thisYear : nextYear;
      const daysAway = Math.round((candidate.getTime() - today.getTime()) / 86400000);
      const monthName = MONTHS[m - 1];

      // Already done this calendar year for this month?
      if (lastDate) {
        const lastYear = lastDate.getFullYear();
        const lastMonth = lastDate.getMonth() + 1;
        if (lastYear === today.getFullYear() && lastMonth === m) continue;
        // Done last year but this year hasn't come yet — still pending
      }

      if (daysAway <= 0) {
        overdue = true;
        nearestLabel = monthName;
        nearestDaysAway = daysAway;
        break;
      }
      if (daysAway < nearestDaysAway) {
        nearestDaysAway = daysAway;
        nearestLabel = `${monthName} (in ${daysAway}d)`;
      }
    }

    if (!lastDate && months.length > 0) {
      return { status: "never-done", label: "NEVER DONE", detail: `Target: ${months.map(m => MONTHS[m-1]).join(", ")}` };
    }
    if (overdue) return { status: "overdue", label: "OVERDUE", detail: `${nearestLabel} service not recorded yet.` };
    if (nearestDaysAway <= 30) return { status: "due-soon", label: "DUE SOON", detail: nearestLabel };
    return { status: "ok", label: "OK", detail: nearestLabel };
  }

  // miles or hours
  if (!interval.lastServiceReading && !interval.lastServiceDate) {
    return { status: "never-done", label: "NEVER DONE", detail: "No service recorded yet." };
  }
  if (!interval.intervalValue) {
    return { status: "never-done", label: "NOT SET", detail: "No interval value set." };
  }

  const lastReading = interval.lastServiceReading ?? 0;
  const nextDue = lastReading + interval.intervalValue;
  const current = currentReading ?? 0;
  const remaining = nextDue - current;

  if (remaining <= 0) {
    return { status: "overdue", label: "OVERDUE", detail: `${Math.abs(remaining).toLocaleString()} ${readingUnit()} past due` };
  }
  const threshold = Math.max(500, interval.intervalValue * 0.1);
  if (remaining <= threshold) {
    return { status: "due-soon", label: "DUE SOON", detail: `${remaining.toLocaleString()} ${readingUnit()} remaining` };
  }
  return { status: "ok", label: "OK", detail: `${remaining.toLocaleString()} ${readingUnit()} until due` };
}

function StatusBadge({ status, label }: { status: DueStatus; label: string }) {
  const cls = {
    overdue: "bg-red-600 text-white",
    "due-soon": "bg-amber-500 text-black",
    ok: "bg-green-600 text-white",
    "never-done": "bg-gray-400 text-white",
  }[status];
  return <span className={`px-3 py-1 rounded-full font-black text-sm uppercase ${cls}`}>{label}</span>;
}

const emptyForm = {
  name: "",
  intervalType: "miles" as "miles" | "hours" | "seasonal",
  intervalValue: "",
  targetMonths: [] as number[],
  notes: "",
};

type FormState = typeof emptyForm;

interface MarkDoneState {
  interval: ServiceInterval;
  reading: string;
  date: string;
}

export function ServiceIntervalsTab({
  carId,
  vehicleType,
}: {
  carId: number;
  vehicleType?: string | null;
}) {
  const qc = useQueryClient();
  const queryKey = `/api/cars/${carId}/service-intervals`;

  const { data: intervals = [], isLoading } = useListServiceIntervals(carId);
  const { data: mileageEntries = [] } = useListMileage(carId);

  const { mutate: createInterval, isPending: creating } = useCreateServiceInterval();
  const { mutate: updateInterval, isPending: updating } = useUpdateServiceInterval();
  const { mutate: markDone, isPending: markingDone } = useMarkServiceDone();
  const { mutate: deleteInterval } = useDeleteServiceInterval();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm, intervalType: defaultIntervalType(vehicleType) });
  const [formError, setFormError] = useState("");

  const [markDoneState, setMarkDoneState] = useState<MarkDoneState | null>(null);
  const [markDoneError, setMarkDoneError] = useState("");

  const sortedMileage = [...mileageEntries].sort((a, b) => b.odometer - a.odometer);
  const currentReading = sortedMileage[0]?.odometer ?? null;

  const sorted = [...intervals].sort((a, b) => {
    const order: Record<DueStatus, number> = { overdue: 0, "due-soon": 1, "never-done": 2, ok: 3 };
    return order[getDueStatus(a, currentReading).status] - order[getDueStatus(b, currentReading).status];
  });

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
    setFormError("");
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, intervalType: defaultIntervalType(vehicleType) });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(si: ServiceInterval) {
    setEditingId(si.id);
    setForm({
      name: si.name,
      intervalType: si.intervalType as "miles" | "hours" | "seasonal",
      intervalValue: si.intervalValue ? String(si.intervalValue) : "",
      targetMonths: parseMonths(si.targetMonths),
      notes: si.notes ?? "",
    });
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function handleSave() {
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (form.intervalType !== "seasonal" && !form.intervalValue) {
      setFormError("Interval value is required."); return;
    }
    if (form.intervalType === "seasonal" && form.targetMonths.length === 0) {
      setFormError("Select at least one target month."); return;
    }

    const data = {
      name: form.name.trim(),
      intervalType: form.intervalType,
      intervalValue: form.intervalType !== "seasonal" ? parseInt(form.intervalValue, 10) : null,
      targetMonths: form.intervalType === "seasonal" ? monthsToString(form.targetMonths) : null,
      notes: form.notes.trim() || null,
    };

    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      closeForm();
    };
    const onError = () => setFormError("Failed to save. Please try again.");

    if (editingId) {
      updateInterval({ carId, intervalId: editingId, data }, { onSuccess, onError });
    } else {
      createInterval({ carId, data }, { onSuccess, onError });
    }
  }

  function openMarkDone(si: ServiceInterval) {
    setMarkDoneState({
      interval: si,
      reading: currentReading ? String(currentReading) : si.lastServiceReading ? String(si.lastServiceReading) : "",
      date: new Date().toISOString().slice(0, 10),
    });
    setMarkDoneError("");
  }

  function handleMarkDone() {
    if (!markDoneState) return;
    const si = markDoneState.interval;
    const readingNum = markDoneState.reading ? parseInt(markDoneState.reading, 10) : null;
    if (si.intervalType !== "seasonal" && (!markDoneState.reading || isNaN(readingNum!))) {
      setMarkDoneError("Enter the current reading."); return;
    }
    markDone({
      carId,
      intervalId: si.id,
      data: {
        lastServiceReading: si.intervalType !== "seasonal" ? readingNum : null,
        lastServiceDate: markDoneState.date,
      },
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [queryKey] });
        setMarkDoneState(null);
      },
      onError: () => setMarkDoneError("Failed to save. Please try again."),
    });
  }

  function handleDelete(si: ServiceInterval) {
    if (!confirm(`Remove "${si.name}" interval?`)) return;
    deleteInterval({ carId, intervalId: si.id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  }

  function toggleMonth(m: number) {
    setForm(prev => {
      const has = prev.targetMonths.includes(m);
      return { ...prev, targetMonths: has ? prev.targetMonths.filter(x => x !== m) : [...prev.targetMonths, m] };
    });
    setFormError("");
  }

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading service intervals...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-100 p-6 rounded-xl border-4 border-black shadow-brutal">
        <div>
          <h2 className="text-2xl font-black uppercase">Service Intervals</h2>
          <p className="text-gray-600 font-medium mt-1">Track recurring maintenance due by mileage, hours, or season.</p>
        </div>
        <Button size="lg" type="button" onClick={openAdd} className="w-full sm:w-auto">
          <Plus className="w-6 h-6 mr-2" /> ADD INTERVAL
        </Button>
      </div>

      {/* Current reading note */}
      {currentReading !== null && (
        <div className="text-sm font-bold text-gray-500 px-1">
          Current reading: <span className="text-black">{currentReading.toLocaleString()} {readingUnit(vehicleType)}</span>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="border-4 border-black rounded-xl p-6 bg-white space-y-5">
          <h3 className="text-xl font-black uppercase">{editingId ? "Edit Interval" : "New Interval"}</h3>

          {formError && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg">{formError}</div>
          )}

          <div className="space-y-1">
            <label className="text-base font-black uppercase block">Name *</label>
            <Input
              value={form.name}
              onChange={e => setField("name", e.target.value)}
              placeholder="e.g. Oil Change, Winterization"
              className="bg-white text-black"
            />
          </div>

          <div className="space-y-1">
            <label className="text-base font-black uppercase block">Interval Type *</label>
            <div className="flex gap-3 flex-wrap">
              {(["miles", "hours", "seasonal"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setField("intervalType", t)}
                  className={`px-5 py-3 rounded-lg border-4 font-black text-base uppercase transition-colors ${
                    form.intervalType === t ? "bg-black text-white border-black" : "bg-white text-black border-black"
                  }`}
                >
                  {t === "miles" ? "Miles" : t === "hours" ? "Hours" : "Seasonal"}
                </button>
              ))}
            </div>
          </div>

          {form.intervalType !== "seasonal" && (
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">
                Every how many {form.intervalType === "hours" ? "hours" : "miles"}? *
              </label>
              <Input
                value={form.intervalValue}
                onChange={e => setField("intervalValue", e.target.value)}
                placeholder={form.intervalType === "hours" ? "e.g. 100" : "e.g. 5000"}
                inputMode="numeric"
                className="bg-white text-black font-mono"
              />
            </div>
          )}

          {form.intervalType === "seasonal" && (
            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Target Month(s) *</label>
              <div className="flex flex-wrap gap-2">
                {MONTHS.map((name, i) => {
                  const m = i + 1;
                  const selected = form.targetMonths.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(m)}
                      className={`px-4 py-2 rounded-lg border-4 font-black text-sm transition-colors ${
                        selected ? "bg-black text-white border-black" : "bg-white text-black border-black"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-base font-black uppercase block">Notes</label>
            <Input
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              placeholder="Optional (e.g. Use synthetic 5W-30)"
              className="bg-white text-black"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" size="lg" className="flex-1" disabled={creating || updating} onClick={handleSave}>
              {creating || updating ? "SAVING..." : "SAVE"}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={closeForm}>
              CANCEL
            </Button>
          </div>
        </div>
      )}

      {/* Mark Done modal */}
      {markDoneState && (
        <div className="border-4 border-green-600 rounded-xl p-6 bg-white space-y-4">
          <h3 className="text-xl font-black uppercase text-green-700">Mark Done: {markDoneState.interval.name}</h3>
          {markDoneError && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg">{markDoneError}</div>
          )}
          {markDoneState.interval.intervalType !== "seasonal" && (
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">
                Current {markDoneState.interval.intervalType === "hours" ? "Engine Hours" : "Odometer"} *
              </label>
              <Input
                value={markDoneState.reading}
                onChange={e => { setMarkDoneState(s => s ? { ...s, reading: e.target.value } : s); setMarkDoneError(""); }}
                inputMode="numeric"
                className="bg-white text-black font-mono"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-base font-black uppercase block">Date Completed *</label>
            <Input
              type="date"
              value={markDoneState.date}
              onChange={e => setMarkDoneState(s => s ? { ...s, date: e.target.value } : s)}
              className="bg-white text-black"
            />
          </div>
          <div className="flex gap-4 pt-2">
            <Button type="button" size="lg" className="flex-1 bg-green-600 hover:bg-green-700 text-white border-green-600" disabled={markingDone} onClick={handleMarkDone}>
              {markingDone ? "SAVING..." : "CONFIRM DONE"}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => setMarkDoneState(null)}>
              CANCEL
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 && !showForm && (
        <div className="text-center py-16 border-4 border-dashed border-black rounded-3xl bg-gray-100">
          <Wrench className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-2xl font-black uppercase mb-2">No Intervals Yet</h3>
          <p className="text-lg text-gray-600">Add recurring services like oil changes, tire rotations, or seasonal prep.</p>
        </div>
      )}

      {/* Interval list */}
      {sorted.length > 0 && (
        <div className="space-y-4">
          {sorted.map(si => {
            const { status, label, detail } = getDueStatus(si, currentReading);
            const borderClass = {
              overdue: "border-red-600",
              "due-soon": "border-amber-500",
              ok: "border-black",
              "never-done": "border-gray-400",
            }[status];

            let intervalDesc = "";
            if (si.intervalType === "seasonal") {
              const months = parseMonths(si.targetMonths);
              intervalDesc = months.length ? months.map(m => MONTHS[m - 1]).join(" · ") : "No months set";
            } else {
              const unit = si.intervalType === "hours" ? "hrs" : "mi";
              intervalDesc = si.intervalValue ? `Every ${si.intervalValue.toLocaleString()} ${unit}` : "Interval not set";
            }

            const lastDoneDesc = si.lastServiceDate
              ? si.intervalType === "seasonal"
                ? si.lastServiceDate
                : `${si.lastServiceDate}${si.lastServiceReading ? ` @ ${si.lastServiceReading.toLocaleString()} ${readingUnit(vehicleType)}` : ""}`
              : "Never done";

            return (
              <div key={si.id} className={`border-4 ${borderClass} bg-white rounded-xl p-5 space-y-3`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xl font-black">{si.name}</span>
                      <StatusBadge status={status} label={label} />
                    </div>
                    <div className="text-base font-bold text-gray-600">{intervalDesc}</div>
                    <div className="text-sm font-medium text-gray-500">{detail}</div>
                    <div className="text-sm font-medium text-gray-500">Last done: {lastDoneDesc}</div>
                    {si.notes && <div className="text-sm text-gray-500 italic">{si.notes}</div>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(si)}
                      className="p-3 border-2 border-black rounded-lg hover:bg-gray-100"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(si)}
                      className="p-3 border-2 border-black rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700 text-white border-green-600"
                  onClick={() => openMarkDone(si)}
                >
                  <CheckCircle className="w-5 h-5 mr-2" /> MARK DONE
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
