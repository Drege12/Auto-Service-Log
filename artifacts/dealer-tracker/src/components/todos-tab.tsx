import { useState } from "react";
import { 
  useListTodos, 
  useCreateTodo, 
  useUpdateTodo, 
  useDeleteTodo,
  TodoEntry,
  CreateTodoEntryPriority
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, CheckCircle2, Circle } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  priority: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function TodosTab({ carId }: { carId: number }) {
  const queryClient = useQueryClient();
  const { data: todos, isLoading } = useListTodos(carId);
  const { mutate: createTodo, isPending: isCreating } = useCreateTodo();
  const { mutate: updateTodo, isPending: isUpdating } = useUpdateTodo();
  const { mutate: deleteTodo } = useDeleteTodo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoEntry | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      priority: "medium",
      notes: ""
    }
  });

  const openNewDialog = () => {
    setEditingTodo(null);
    form.reset({
      description: "",
      priority: "medium",
      notes: ""
    });
    setDialogOpen(true);
  };

  const openEditDialog = (todo: TodoEntry) => {
    setEditingTodo(todo);
    form.reset({
      description: todo.description,
      priority: todo.priority as "low" | "medium" | "high",
      notes: todo.notes || ""
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      priority: values.priority as CreateTodoEntryPriority,
    };

    if (editingTodo) {
      updateTodo({ carId, todoId: editingTodo.id, data: { ...payload, completed: editingTodo.completed } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] });
          setDialogOpen(false);
        }
      });
    } else {
      createTodo({ carId, data: { ...payload, completed: false } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] });
          setDialogOpen(false);
        }
      });
    }
  };

  const toggleComplete = (todo: TodoEntry) => {
    updateTodo({ carId, todoId: todo.id, data: { 
      description: todo.description,
      priority: todo.priority,
      notes: todo.notes,
      completed: !todo.completed 
    } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteTodo({ carId, todoId: id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] });
        }
      });
    }
  };

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading needs...</div>;

  const pendingTodos = todos?.filter(t => !t.completed) || [];
  const completedTodos = todos?.filter(t => t.completed) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-black uppercase">Needs Attention</h2>
        <Button size="lg" onClick={openNewDialog}>
          <Plus className="w-6 h-6 mr-2" />
          ADD ITEM
        </Button>
      </div>

      <div className="space-y-6">
        {todos?.length === 0 ? (
          <div className="p-12 border-4 border-dashed border-muted-foreground/30 rounded-2xl text-center">
            <h3 className="text-2xl font-bold text-muted-foreground">All caught up!</h3>
            <p className="mt-2 text-lg text-muted-foreground">No pending tasks for this vehicle.</p>
          </div>
        ) : (
          <>
            {pendingTodos.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-widest border-b-2 border-black pb-2">To Do</h3>
                {pendingTodos.map(todo => (
                  <div key={todo.id} className="flex flex-col lg:flex-row items-start lg:items-center gap-4 p-4 lg:p-6 border-4 border-black rounded-xl bg-card shadow-brutal transition-transform hover:-translate-y-1">
                    <button 
                      onClick={() => toggleComplete(todo)}
                      className="flex-shrink-0 text-muted-foreground hover:text-black transition-colors tap-target flex items-center justify-center"
                    >
                      <Circle className="w-10 h-10 border-4 border-black rounded-full text-transparent hover:bg-black/10" />
                    </button>
                    
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-2xl font-black">{todo.description}</h3>
                        <Badge 
                          variant={todo.priority === 'high' ? 'destructive' : todo.priority === 'medium' ? 'warning' : 'secondary'}
                        >
                          {todo.priority} PRIORITY
                        </Badge>
                      </div>
                      {todo.notes && (
                        <p className="text-lg text-muted-foreground font-medium">{todo.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex w-full lg:w-auto gap-3 mt-4 lg:mt-0">
                      <Button variant="outline" onClick={() => openEditDialog(todo)} className="flex-1 lg:flex-none">
                        <Edit2 className="w-5 h-5" />
                      </Button>
                      <Button variant="outline" onClick={() => handleDelete(todo.id)} className="flex-1 lg:flex-none hover:bg-destructive hover:text-destructive-foreground hover:border-destructive border-2">
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedTodos.length > 0 && (
              <div className="space-y-4 mt-12 opacity-70 hover:opacity-100 transition-opacity">
                <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-widest border-b-2 border-black pb-2">Completed</h3>
                {completedTodos.map(todo => (
                  <div key={todo.id} className="flex flex-col lg:flex-row items-start lg:items-center gap-4 p-4 border-2 border-black rounded-xl bg-secondary">
                    <button 
                      onClick={() => toggleComplete(todo)}
                      className="flex-shrink-0 text-black transition-colors tap-target flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-10 h-10" />
                    </button>
                    
                    <div className="flex-1 w-full line-through text-muted-foreground">
                      <h3 className="text-xl font-bold">{todo.description}</h3>
                    </div>
                    
                    <Button variant="ghost" onClick={() => handleDelete(todo.id)} className="w-full lg:w-auto mt-2 lg:mt-0 hover:bg-destructive hover:text-white">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTodo ? "EDIT ITEM" : "NEW ITEM"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Description *</label>
              <Input placeholder="What needs to be done?" {...form.register("description")} />
              {form.formState.errors.description && <p className="text-destructive font-bold">{form.formState.errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Priority</label>
              <div className="flex flex-wrap gap-4">
                {["low", "medium", "high"].map((p) => (
                  <label key={p} className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-4 border-2 border-black rounded-lg cursor-pointer tap-target font-bold uppercase transition-colors shadow-brutal-sm",
                    form.watch("priority") === p ? "bg-black text-white" : "bg-background hover:bg-secondary"
                  )}>
                    <input 
                      type="radio" 
                      value={p} 
                      className="sr-only"
                      {...form.register("priority")} 
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Notes</label>
              <Textarea placeholder="Parts needed, location, etc..." {...form.register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
              <Button type="submit" size="lg" disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? "SAVING..." : "SAVE ITEM"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
