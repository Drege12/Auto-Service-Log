import { useState } from "react";
import { useListTodos, useCreateTodo, useUpdateTodo, useDeleteTodo, useCreateMaintenance, TodoEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, CheckCircle2, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high";
type FormState = { description: string; priority: Priority; notes: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

type CompleteForm = { workPerformed: string; correctiveAction: string; date: string; technician: string };
type CompleteErrors = Partial<Record<keyof CompleteForm, string>>;

const emptyForm = (): FormState => ({ description: "", priority: "medium", notes: "" });

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-600 text-white border-red-600",
  medium: "bg-yellow-500 text-black border-yellow-500",
  low: "bg-gray-400 text-white border-gray-400",
};

const PRIORITY_UNSELECTED = "bg-white text-black border-black";

export function TodosTab({ carId }: { carId: number }) {
  const queryClient = useQueryClient();
  const { data: todos, isLoading } = useListTodos(carId);
  const { mutate: createTodo, isPending: isCreating } = useCreateTodo();
  const { mutate: updateTodo, isPending: isUpdating } = useUpdateTodo();
  const { mutate: deleteTodo } = useDeleteTodo();
  const { mutate: createMaintenance, isPending: isLogging } = useCreateMaintenance();

  // --- Add/Edit todo dialog ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoEntry | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  // --- Complete task dialog ---
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completingTodo, setCompletingTodo] = useState<TodoEntry | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteForm>({ workPerformed: "", correctiveAction: "", date: "", technician: "" });
  const [completeErrors, setCompleteErrors] = useState<CompleteErrors>({});
  const [completeSubmitError, setCompleteSubmitError] = useState("");

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const setCompleteField = (field: keyof CompleteForm, value: string) => {
    setCompleteForm(prev => ({ ...prev, [field]: value }));
    if (completeErrors[field]) setCompleteErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateComplete = (): boolean => {
    const e: CompleteErrors = {};
    if (!completeForm.workPerformed.trim()) e.workPerformed = "Work performed is required";
    if (!completeForm.date) e.date = "Date is required";
    setCompleteErrors(e);
    return Object.keys(e).length === 0;
  };

  const openNewDialog = () => {
    setEditingTodo(null);
    setForm(emptyForm());
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const openEditDialog = (todo: TodoEntry) => {
    setEditingTodo(todo);
    setForm({
      description: todo.description,
      priority: (todo.priority as Priority) || "medium",
      notes: todo.notes || "",
    });
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const openCompleteDialog = (todo: TodoEntry) => {
    setCompletingTodo(todo);
    setCompleteForm({
      workPerformed: todo.description,
      correctiveAction: "",
      date: new Date().toISOString().split("T")[0],
      technician: "",
    });
    setCompleteErrors({});
    setCompleteSubmitError("");
    setCompleteDialogOpen(true);
  };

  const handleSubmit = () => {
    setSubmitError("");
    if (!validate()) return;

    const invalidateKey = [`/api/cars/${carId}/todos`];

    if (editingTodo) {
      updateTodo({
        carId, todoId: editingTodo.id,
        data: { description: form.description.trim(), priority: form.priority, notes: form.notes.trim() || undefined, completed: editingTodo.completed },
      }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: invalidateKey }); setDialogOpen(false); },
        onError: () => setSubmitError("Failed to save. Please try again."),
      });
    } else {
      createTodo({
        carId,
        data: { description: form.description.trim(), priority: form.priority, notes: form.notes.trim() || undefined, completed: false },
      }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: invalidateKey }); setDialogOpen(false); },
        onError: () => setSubmitError("Failed to save. Please try again."),
      });
    }
  };

  const handleCompleteSubmit = () => {
    if (!completingTodo) return;
    setCompleteSubmitError("");
    if (!validateComplete()) return;

    const notesText = [
      completeForm.correctiveAction.trim() ? `Corrective action: ${completeForm.correctiveAction.trim()}` : "",
      completingTodo.notes ? `Original issue: ${completingTodo.notes}` : "",
    ].filter(Boolean).join("\n");

    createMaintenance({
      carId,
      data: {
        date: completeForm.date,
        description: completeForm.workPerformed.trim(),
        technician: completeForm.technician.trim() || undefined,
        notes: notesText || undefined,
      },
    }, {
      onSuccess: () => {
        updateTodo({
          carId, todoId: completingTodo.id,
          data: {
            description: completingTodo.description,
            priority: completingTodo.priority,
            notes: completingTodo.notes,
            completed: true,
          },
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] });
            queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/maintenance`] });
            setCompleteDialogOpen(false);
          },
          onError: () => setCompleteSubmitError("Logged to maintenance but failed to mark done. Please try again."),
        });
      },
      onError: () => setCompleteSubmitError("Failed to log maintenance entry. Please try again."),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this item?")) return;
    deleteTodo({ carId, todoId: id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] }),
    });
  };

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading...</div>;

  const pendingTodos = todos?.filter(t => !t.completed) || [];
  const completedTodos = todos?.filter(t => t.completed) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-black uppercase">Needs Attention</h2>
        <Button size="lg" onClick={openNewDialog}>
          <Plus className="w-6 h-6 mr-2" /> ADD ITEM
        </Button>
      </div>

      {todos?.length === 0 && (
        <div className="p-12 border-4 border-dashed border-gray-400 rounded-2xl text-center">
          <h3 className="text-2xl font-bold text-gray-500">All caught up!</h3>
          <p className="mt-2 text-lg text-gray-500">No pending tasks for this vehicle.</p>
        </div>
      )}

      {pendingTodos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-500 uppercase tracking-widest border-b-2 border-black pb-2">To Do</h3>
          {pendingTodos.map(todo => (
            <div key={todo.id} className="flex flex-col gap-4 p-4 lg:p-6 border-4 border-black rounded-xl bg-white shadow-brutal">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-black">{todo.description}</h3>
                    <span className={cn("px-3 py-1 rounded font-black uppercase text-sm border-2", PRIORITY_COLORS[todo.priority as Priority] || PRIORITY_COLORS.medium)}>
                      {todo.priority}
                    </span>
                  </div>
                  {todo.notes && <p className="text-lg text-gray-600 font-medium">{todo.notes}</p>}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="flex-1 bg-black text-white text-lg font-black uppercase border-2 border-black"
                  onClick={() => openCompleteDialog(todo)}
                >
                  <ClipboardCheck className="w-6 h-6 mr-2" /> COMPLETED
                </Button>
                <Button type="button" variant="outline" onClick={() => openEditDialog(todo)} className="px-5">
                  <Edit2 className="w-5 h-5" />
                </Button>
                <Button type="button" variant="destructive" onClick={() => handleDelete(todo.id)} className="px-5">
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {completedTodos.length > 0 && (
        <div className="space-y-4 mt-8 opacity-60">
          <h3 className="text-xl font-bold text-gray-500 uppercase tracking-widest border-b-2 border-black pb-2">Completed</h3>
          {completedTodos.map(todo => (
            <div key={todo.id} className="flex items-center gap-4 p-4 border-2 border-gray-400 rounded-xl bg-gray-50">
              <CheckCircle2 className="w-8 h-8 flex-shrink-0 text-black" />
              <div className="flex-1">
                <h3 className="text-xl font-bold line-through text-gray-500">{todo.description}</h3>
              </div>
              <Button type="button" variant="outline" onClick={() => handleDelete(todo.id)}>
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Todo Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">{editingTodo ? "Edit Item" : "New Item"}</DialogTitle>
          </DialogHeader>

          {submitError && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-4 rounded-lg">{submitError}</div>
          )}

          <div className="space-y-5 mt-2">
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Description *</label>
              <Input
                value={form.description}
                onChange={e => setField("description", e.target.value)}
                placeholder="What needs to be done?"
              />
              {errors.description && <p className="text-red-600 font-bold">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Priority</label>
              <div className="flex gap-3">
                {(["low", "medium", "high"] as Priority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setField("priority", p)}
                    className={cn(
                      "flex-1 py-3 px-4 border-2 rounded-lg font-black uppercase text-base",
                      form.priority === p ? PRIORITY_COLORS[p] : PRIORITY_UNSELECTED
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Notes</label>
              <Textarea
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
                placeholder="Parts needed, location, etc..."
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
            <Button type="button" size="lg" disabled={isCreating || isUpdating} onClick={handleSubmit}>
              {isCreating || isUpdating ? "SAVING..." : "SAVE ITEM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Task Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">Log Completed Work</DialogTitle>
          </DialogHeader>

          {completingTodo && (
            <div className="bg-gray-100 border-2 border-black rounded-lg p-4 text-lg font-bold">
              Task: {completingTodo.description}
            </div>
          )}

          {completeSubmitError && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-4 rounded-lg">{completeSubmitError}</div>
          )}

          <div className="space-y-5 mt-2">
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Work Performed *</label>
              <Input
                value={completeForm.workPerformed}
                onChange={e => setCompleteField("workPerformed", e.target.value)}
                placeholder="What was done?"
              />
              {completeErrors.workPerformed && <p className="text-red-600 font-bold">{completeErrors.workPerformed}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Corrective Action / Details</label>
              <Textarea
                value={completeForm.correctiveAction}
                onChange={e => setCompleteField("correctiveAction", e.target.value)}
                placeholder="Describe what was found and what was done to fix it..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Date *</label>
                <Input
                  type="date"
                  value={completeForm.date}
                  onChange={e => setCompleteField("date", e.target.value)}
                />
                {completeErrors.date && <p className="text-red-600 font-bold">{completeErrors.date}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Technician</label>
                <Input
                  value={completeForm.technician}
                  onChange={e => setCompleteField("technician", e.target.value)}
                  placeholder="Name"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" size="lg" onClick={() => setCompleteDialogOpen(false)}>CANCEL</Button>
            <Button type="button" size="lg" disabled={isLogging || isUpdating} onClick={handleCompleteSubmit}>
              {isLogging || isUpdating ? "SAVING..." : "LOG & COMPLETE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
