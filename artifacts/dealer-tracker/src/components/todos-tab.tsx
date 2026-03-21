import { useState } from "react";
import { useListTodos, useCreateTodo, useUpdateTodo, useDeleteTodo, TodoEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high";
type FormState = { description: string; priority: Priority; notes: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoEntry | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
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

  const toggleComplete = (todo: TodoEntry) => {
    updateTodo({
      carId, todoId: todo.id,
      data: { description: todo.description, priority: todo.priority, notes: todo.notes, completed: !todo.completed },
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] }),
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
            <div key={todo.id} className="flex flex-col lg:flex-row items-start lg:items-center gap-4 p-4 lg:p-6 border-4 border-black rounded-xl bg-white shadow-brutal">
              <button onClick={() => toggleComplete(todo)} className="flex-shrink-0 p-2">
                <Circle className="w-10 h-10 text-black" />
              </button>
              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-2xl font-black">{todo.description}</h3>
                  <span className={cn("px-3 py-1 rounded font-black uppercase text-sm border-2", PRIORITY_COLORS[todo.priority as Priority] || PRIORITY_COLORS.medium)}>
                    {todo.priority} priority
                  </span>
                </div>
                {todo.notes && <p className="text-lg text-gray-600 font-medium">{todo.notes}</p>}
              </div>
              <div className="flex w-full lg:w-auto gap-3">
                <Button variant="outline" onClick={() => openEditDialog(todo)} className="flex-1 lg:flex-none">
                  <Edit2 className="w-5 h-5" />
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(todo.id)} className="flex-1 lg:flex-none">
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
              <button onClick={() => toggleComplete(todo)} className="flex-shrink-0 p-2">
                <CheckCircle2 className="w-10 h-10 text-black" />
              </button>
              <div className="flex-1">
                <h3 className="text-xl font-bold line-through text-gray-500">{todo.description}</h3>
              </div>
              <Button variant="outline" onClick={() => handleDelete(todo.id)}>
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
