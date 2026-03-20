import { useState } from "react";
import { 
  useListMaintenance, 
  useCreateMaintenance, 
  useUpdateMaintenance, 
  useDeleteMaintenance,
  MaintenanceEntry
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { Plus, Edit2, Trash2, Calendar, User, DollarSign } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  technician: z.string().optional(),
  cost: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function MaintenanceTab({ carId }: { carId: number }) {
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useListMaintenance(carId);
  const { mutate: createEntry, isPending: isCreating } = useCreateMaintenance();
  const { mutate: updateEntry, isPending: isUpdating } = useUpdateMaintenance();
  const { mutate: deleteEntry } = useDeleteMaintenance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MaintenanceEntry | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      description: "",
      technician: "",
      cost: undefined,
      notes: ""
    }
  });

  const openNewDialog = () => {
    setEditingEntry(null);
    form.reset({
      date: new Date().toISOString().split('T')[0],
      description: "",
      technician: "",
      cost: undefined,
      notes: ""
    });
    setDialogOpen(true);
  };

  const openEditDialog = (entry: MaintenanceEntry) => {
    setEditingEntry(entry);
    form.reset({
      date: entry.date,
      description: entry.description,
      technician: entry.technician || "",
      cost: entry.cost || undefined,
      notes: entry.notes || ""
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    if (editingEntry) {
      updateEntry({ carId, entryId: editingEntry.id, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/maintenance`] });
          setDialogOpen(false);
        }
      });
    } else {
      createEntry({ carId, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/maintenance`] });
          setDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this log entry?")) {
      deleteEntry({ carId, entryId: id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/maintenance`] });
        }
      });
    }
  };

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading logs...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-black uppercase">Service History</h2>
        <Button size="lg" onClick={openNewDialog}>
          <Plus className="w-6 h-6 mr-2" />
          ADD ENTRY
        </Button>
      </div>

      <div className="space-y-6">
        {entries?.length === 0 ? (
          <div className="p-12 border-4 border-dashed border-muted-foreground/30 rounded-2xl text-center">
            <h3 className="text-2xl font-bold text-muted-foreground">No maintenance records yet.</h3>
            <p className="mt-2 text-lg text-muted-foreground">Click Add Entry to start tracking work.</p>
          </div>
        ) : (
          entries?.map(entry => (
            <div key={entry.id} className="p-6 border-4 border-black rounded-xl bg-card shadow-brutal transition-transform hover:-translate-y-1">
              <div className="flex flex-col lg:flex-row justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground font-bold mb-1">
                      <Calendar className="w-5 h-5" />
                      {formatDate(entry.date)}
                    </div>
                    <h3 className="text-2xl font-black uppercase">{entry.description}</h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-6">
                    {entry.technician && (
                      <div className="flex items-center gap-2 font-medium bg-secondary px-3 py-1 border-2 border-black rounded-md">
                        <User className="w-4 h-4" />
                        Tech: {entry.technician}
                      </div>
                    )}
                    {entry.cost !== undefined && entry.cost !== null && (
                      <div className="flex items-center gap-2 font-medium bg-secondary px-3 py-1 border-2 border-black rounded-md">
                        <DollarSign className="w-4 h-4" />
                        Cost: ${entry.cost.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  {entry.notes && (
                    <div className="mt-4 p-4 bg-secondary border-l-4 border-black font-medium">
                      {entry.notes}
                    </div>
                  )}
                </div>
                
                <div className="flex lg:flex-col gap-3">
                  <Button variant="outline" onClick={() => openEditDialog(entry)} className="flex-1 lg:flex-none">
                    <Edit2 className="w-5 h-5 lg:mr-2" />
                    <span className="hidden lg:inline">EDIT</span>
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(entry.id)} className="flex-1 lg:flex-none">
                    <Trash2 className="w-5 h-5 lg:mr-2" />
                    <span className="hidden lg:inline">DELETE</span>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "EDIT LOG ENTRY" : "NEW LOG ENTRY"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Date *</label>
              <Input type="date" {...form.register("date")} />
              {form.formState.errors.date && <p className="text-destructive font-bold">{form.formState.errors.date.message}</p>}
            </div>
            
            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Work Performed *</label>
              <Input placeholder="e.g. Oil Change, Brake Pad Replacement" {...form.register("description")} />
              {form.formState.errors.description && <p className="text-destructive font-bold">{form.formState.errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Technician</label>
                <Input placeholder="Name" {...form.register("technician")} />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Cost ($)</label>
                <Input type="number" step="0.01" placeholder="0.00" {...form.register("cost")} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Notes</label>
              <Textarea placeholder="Any additional details..." {...form.register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
              <Button type="submit" size="lg" disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? "SAVING..." : "SAVE ENTRY"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
