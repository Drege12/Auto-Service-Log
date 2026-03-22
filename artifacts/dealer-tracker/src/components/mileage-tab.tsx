import { useState } from "react";
import { useListMileage, useCreateMileageEntry, useDeleteMileageEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gauge, Plus, Trash2, TrendingUp } from "lucide-react";

const REASON_OPTIONS = [
  "Test Drive",
  "Road Test / QC",
  "Parts Run",
  "Customer Demo",
  "Delivery",
  "Shop Move",
  "Detail / Wash",
  "Other",
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  odometer: "",
  reason: "Test Drive",
  technician: "",
  notes: "",
};

type FormState = typeof emptyForm;

export function MileageTab({ carId, initialMileage, originalMileage }: { carId: number; initialMileage?: number; originalMileage?: number }) {
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useListMileage(carId);
  const { mutate: createEntry, isPending } = useCreateMileageEntry();
  const { mutate: deleteEntry } = useDeleteMileageEntry();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");

  const setField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = () => {
    const odo = parseInt(form.odometer, 10);
    if (!form.odometer || isNaN(odo) || odo <= 0) {
      setError("Enter a valid odometer reading.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Reason is required.");
      return;
    }
    createEntry({ carId, data: {
      date: form.date,
      odometer: odo,
      reason: form.reason.trim(),
      technician: form.technician.trim() || null,
      notes: form.notes.trim() || null,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/mileage`] });
        setForm(emptyForm);
        setShowForm(false);
        setError("");
      },
      onError: () => setError("Failed to save. Please try again."),
    });
  };

  const handleDelete = (entryId: number) => {
    if (!confirm("Remove this mileage entry?")) return;
    deleteEntry({ carId, entryId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/mileage`] }),
    });
  };

  const sortedEntries = [...entries].sort((a, b) => a.odometer - b.odometer);
  const asAcquired = originalMileage ?? initialMileage ?? null;
  const lastOdo = sortedEntries[sortedEntries.length - 1]?.odometer ?? initialMileage ?? null;
  const dealerMiles = asAcquired !== null && lastOdo !== null && lastOdo > asAcquired
    ? lastOdo - asAcquired
    : null;

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading mileage log...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-100 p-6 rounded-xl border-4 border-black shadow-brutal">
        <div>
          <h2 className="text-2xl font-black uppercase">Mileage Log</h2>
          <p className="text-gray-600 font-medium mt-1">Track odometer readings after test drives and moves.</p>
        </div>
        <Button size="lg" onClick={() => { setShowForm(prev => !prev); setError(""); }} className="w-full sm:w-auto">
          <Plus className="w-6 h-6 mr-2" />
          {showForm ? "CANCEL" : "ADD READING"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {asAcquired !== null && (
          <div className="border-4 border-black bg-white rounded-xl p-5 text-center">
            <div className="text-2xl font-black font-mono">{asAcquired.toLocaleString()}</div>
            <div className="text-gray-500 font-bold uppercase text-sm mt-1">As Acquired (mi)</div>
          </div>
        )}
        {lastOdo !== null && (
          <div className="border-4 border-black bg-white rounded-xl p-5 text-center">
            <div className="text-2xl font-black font-mono">{lastOdo.toLocaleString()}</div>
            <div className="text-gray-500 font-bold uppercase text-sm mt-1">Current (mi)</div>
          </div>
        )}
        {dealerMiles !== null && (
          <div className="border-4 border-black bg-black text-white rounded-xl p-5 text-center">
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-6 h-6" />
              <span className="text-2xl font-black">+{dealerMiles.toLocaleString()}</span>
            </div>
            <div className="text-gray-300 font-bold uppercase text-sm mt-1">Dealer Miles Added</div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="border-4 border-black rounded-xl p-6 bg-white space-y-5">
          <h3 className="text-xl font-black uppercase">New Odometer Reading</h3>

          {error && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Date *</label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setField("date", e.target.value)}
                className="bg-white text-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Odometer (miles) *</label>
              <Input
                value={form.odometer}
                onChange={e => setField("odometer", e.target.value)}
                placeholder="e.g. 47523"
                inputMode="numeric"
                className="bg-white text-black font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Reason *</label>
              <select
                value={form.reason}
                onChange={e => setField("reason", e.target.value)}
                className="w-full border-2 border-black rounded-lg px-4 py-3 text-base font-bold bg-white text-black focus:outline-none focus:ring-2 focus:ring-black"
              >
                {REASON_OPTIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Technician</label>
              <Input
                value={form.technician}
                onChange={e => setField("technician", e.target.value)}
                placeholder="Name (optional)"
                className="bg-white text-black"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-base font-black uppercase block">Notes</label>
            <Input
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              placeholder="Optional notes"
              className="bg-white text-black"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" size="lg" className="flex-1" disabled={isPending} onClick={handleSubmit}>
              {isPending ? "SAVING..." : "SAVE READING"}
            </Button>
          </div>
        </div>
      )}

      {sortedEntries.length === 0 && !showForm && (
        <div className="text-center py-16 border-4 border-dashed border-black rounded-3xl bg-gray-100">
          <Gauge className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-2xl font-black uppercase mb-2">No Readings Yet</h3>
          <p className="text-lg text-gray-600">Add the first odometer reading to start tracking dealer miles.</p>
        </div>
      )}

      {sortedEntries.length > 0 && (
        <div className="space-y-3">
          {[...sortedEntries].reverse().map((entry, i, arr) => {
            const prevEntry = arr[i + 1];
            const prevOdo = prevEntry?.odometer ?? initialMileage ?? null;
            const delta = prevOdo !== null ? entry.odometer - prevOdo : null;
            return (
              <div key={entry.id} className="border-4 border-black bg-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-black font-mono">{entry.odometer.toLocaleString()} mi</span>
                    {delta !== null && delta > 0 && (
                      <span className="bg-gray-200 text-black font-black text-sm px-2 py-1 rounded">
                        +{delta.toLocaleString()} mi
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-base font-bold text-gray-700">
                    <span className="bg-black text-white px-2 py-0.5 rounded font-bold">{entry.reason}</span>
                    <span>{entry.date}</span>
                    {entry.technician && <span>Tech: {entry.technician}</span>}
                  </div>
                  {entry.notes && (
                    <div className="text-gray-600 font-medium text-sm">{entry.notes}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  className="flex-shrink-0 p-3 border-2 border-black rounded-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
