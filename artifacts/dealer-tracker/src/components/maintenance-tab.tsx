import { useState, useRef } from "react";
import { useListMaintenance, useCreateMaintenance, useUpdateMaintenance, useDeleteMaintenance, MaintenanceEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Calendar, User, DollarSign, Clock, Printer } from "lucide-react";
import { printSection } from "@/lib/print-utils";

type FormState = { date: string; description: string; technician: string; hours: string; cost: string; notes: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm = (): FormState => ({
  date: new Date().toISOString().split("T")[0],
  description: "",
  technician: "",
  hours: "",
  cost: "",
  notes: "",
});

export function MaintenanceTab({ carId, carLabel }: { carId: number; carLabel: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useListMaintenance(carId);
  const { mutate: createEntry, isPending: isCreating } = useCreateMaintenance();
  const { mutate: updateEntry, isPending: isUpdating } = useUpdateMaintenance();
  const { mutate: deleteEntry } = useDeleteMaintenance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MaintenanceEntry | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  const setField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.date) e.date = "Date is required";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openNewDialog = () => {
    setEditingEntry(null);
    setForm(emptyForm());
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const openEditDialog = (entry: MaintenanceEntry) => {
    setEditingEntry(entry);
    setForm({
      date: entry.date,
      description: entry.description,
      technician: entry.technician || "",
      hours: entry.hours != null ? String(entry.hours) : "",
      cost: entry.cost != null ? String(entry.cost) : "",
      notes: entry.notes || "",
    });
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    setSubmitError("");
    if (!validate()) return;

    const data = {
      date: form.date,
      description: form.description.trim(),
      technician: form.technician.trim() || undefined,
      hours: form.hours ? Number(form.hours) : undefined,
      cost: form.cost ? Number(form.cost) : undefined,
      notes: form.notes.trim() || undefined,
    };

    const invalidateKey = [`/api/cars/${carId}/maintenance`];

    if (editingEntry) {
      updateEntry({ carId, entryId: editingEntry.id, data }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: invalidateKey }); setDialogOpen(false); },
        onError: () => setSubmitError("Failed to save. Please try again."),
      });
    } else {
      createEntry({ carId, data }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: invalidateKey }); setDialogOpen(false); },
        onError: () => setSubmitError("Failed to save. Please try again."),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this log entry?")) return;
    deleteEntry({ carId, entryId: id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/maintenance`] }),
    });
  };

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading logs...</div>;

  return (
    <div ref={contentRef} className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-black uppercase">Service History</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button type="button" variant="outline" size="lg" onClick={() => contentRef.current && printSection(`${carLabel} — Service History`, contentRef.current)}>
            <Printer className="w-5 h-5 mr-2" /> PRINT
          </Button>
          <Button size="lg" onClick={openNewDialog}>
            <Plus className="w-6 h-6 mr-2" /> ADD ENTRY
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {entries?.length === 0 ? (
          <div className="p-12 border-4 border-dashed border-gray-400 rounded-2xl text-center">
            <h3 className="text-2xl font-bold text-gray-500">No maintenance records yet.</h3>
            <p className="mt-2 text-lg text-gray-500">Click Add Entry to start tracking work.</p>
          </div>
        ) : entries?.map(entry => (
          <div key={entry.id} className="p-6 border-4 border-black rounded-xl bg-white shadow-brutal">
            <div className="flex flex-col lg:flex-row justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-gray-600 font-bold">
                  <Calendar className="w-5 h-5" />
                  {entry.date}
                </div>
                <h3 className="text-2xl font-black uppercase">{entry.description}</h3>
                <div className="flex flex-wrap gap-3">
                  {entry.technician && (
                    <div className="flex items-center gap-2 font-medium bg-gray-100 px-3 py-1 border-2 border-black rounded-md">
                      <User className="w-4 h-4" /> Tech: {entry.technician}
                    </div>
                  )}
                  {entry.hours != null && (
                    <div className="flex items-center gap-2 font-medium bg-blue-50 px-3 py-1 border-2 border-blue-800 rounded-md text-blue-900">
                      <Clock className="w-4 h-4" /> {Number(entry.hours) === 1 ? "1 hr" : `${Number(entry.hours)} hrs`}
                    </div>
                  )}
                  {entry.cost != null && (
                    <div className="flex items-center gap-2 font-medium bg-gray-100 px-3 py-1 border-2 border-black rounded-md">
                      <DollarSign className="w-4 h-4" /> ${Number(entry.cost).toFixed(2)}
                    </div>
                  )}
                </div>
                {entry.notes && (
                  <div className="mt-2 p-3 bg-gray-100 border-l-4 border-black font-medium">{entry.notes}</div>
                )}
              </div>
              <div className="flex lg:flex-col gap-3">
                <Button variant="outline" onClick={() => openEditDialog(entry)} className="flex-1 lg:flex-none">
                  <Edit2 className="w-5 h-5 lg:mr-2" /><span className="hidden lg:inline">EDIT</span>
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(entry.id)} className="flex-1 lg:flex-none">
                  <Trash2 className="w-5 h-5 lg:mr-2" /><span className="hidden lg:inline">DELETE</span>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">{editingEntry ? "Edit Log Entry" : "New Log Entry"}</DialogTitle>
          </DialogHeader>

          {submitError && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-4 rounded-lg">{submitError}</div>
          )}

          <div className="space-y-5 mt-2">
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Date *</label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setField("date", e.target.value)}
              />
              {errors.date && <p className="text-red-600 font-bold">{errors.date}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Work Performed *</label>
              <Input
                value={form.description}
                onChange={e => setField("description", e.target.value)}
                placeholder="e.g. Oil Change, Brake Pad Replacement"
              />
              {errors.description && <p className="text-red-600 font-bold">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Technician</label>
                <Input value={form.technician} onChange={e => setField("technician", e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Hours
                </label>
                <Input
                  value={form.hours}
                  onChange={e => setField("hours", e.target.value)}
                  placeholder="e.g. 1.5"
                  inputMode="decimal"
                  className="bg-white text-black"
                />
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Cost ($)</label>
                <Input value={form.cost} onChange={e => setField("cost", e.target.value)} placeholder="0.00" inputMode="decimal" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Notes</label>
              <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="Any additional details..." />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
            <Button type="button" size="lg" disabled={isCreating || isUpdating} onClick={handleSubmit}>
              {isCreating || isUpdating ? "SAVING..." : "SAVE ENTRY"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
