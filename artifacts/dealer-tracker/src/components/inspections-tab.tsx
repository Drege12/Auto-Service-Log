import { useState, useEffect, useRef } from "react";
import { 
  useGetInspection, 
  useUpsertInspection,
  useCreateTodo,
  UpsertInspectionItemStatus,
  InspectionItem
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { INSPECTION_CATEGORIES, buildDefaultInspection } from "@/lib/inspection-template";
import { Save, AlertCircle, CheckCircle2, HelpCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

export function InspectionsTab({ carId }: { carId: number }) {
  const queryClient = useQueryClient();
  const { data: inspectionItems, isLoading, isError } = useGetInspection(carId);
  const { mutate: upsertInspection, isPending } = useUpsertInspection();
  const { mutate: createTodo } = useCreateTodo();

  const [localItems, setLocalItems] = useState<Partial<InspectionItem>[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  // Track which item names were already "fail" when we last loaded/saved,
  // so we only add new failures to the todo list, not pre-existing ones.
  const previouslyFailedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (inspectionItems) {
      const items = inspectionItems.length === 0 ? buildDefaultInspection() : inspectionItems;
      setLocalItems(items);
      setIsDirty(false);
      // Record which items are already failed so we don't duplicate todos on next save
      previouslyFailedRef.current = new Set(
        items.filter(i => i.status === "fail").map(i => i.item as string)
      );
    }
  }, [inspectionItems]);

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading inspection...</div>;
  if (isError) return <div className="p-12 text-center text-2xl font-bold text-red-600">Error loading inspection.</div>;

  const handleStatusChange = (index: number, status: UpsertInspectionItemStatus) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], status };
    setLocalItems(newItems);
    setIsDirty(true);
    setSavedMessage("");
  };

  const handleNotesChange = (index: number, notes: string) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], notes };
    setLocalItems(newItems);
    setIsDirty(true);
    setSavedMessage("");
  };

  const handleSave = () => {
    const payload = localItems.map(item => ({
      id: item.id,
      category: item.category || "Unknown",
      item: item.item || "Unknown",
      status: item.status as UpsertInspectionItemStatus,
      notes: item.notes || ""
    }));

    // Find items that just became "fail" (weren't failed before this session)
    const newlyFailed = localItems.filter(item =>
      item.status === "fail" &&
      item.item &&
      !previouslyFailedRef.current.has(item.item as string)
    );

    upsertInspection({ carId, data: payload }, {
      onSuccess: () => {
        setIsDirty(false);

        // Update our baseline of what's failed
        previouslyFailedRef.current = new Set(
          localItems.filter(i => i.status === "fail").map(i => i.item as string)
        );

        // Create a todo for each newly-failed item
        if (newlyFailed.length > 0) {
          newlyFailed.forEach(item => {
            createTodo({
              carId,
              data: {
                description: `${item.category}: ${item.item}`,
                priority: "high",
                notes: item.notes || undefined,
                completed: false,
              }
            }, {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] });
              }
            });
          });
          setSavedMessage(`Saved. ${newlyFailed.length} failed item${newlyFailed.length > 1 ? "s" : ""} added to the to-do list.`);
        } else {
          setSavedMessage("Saved.");
        }

        setTimeout(() => setSavedMessage(""), 4000);
      }
    });
  };

  const StatusButton = ({ 
    currentStatus, 
    targetStatus, 
    onClick, 
    icon: Icon, 
    label 
  }: { 
    currentStatus: string;
    targetStatus: UpsertInspectionItemStatus;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
  }) => {
    const isActive = currentStatus === targetStatus;

    let activeClass = "bg-gray-200 border-gray-400 text-gray-700";
    if (isActive) {
      if (targetStatus === "pass") activeClass = "bg-black text-white border-black";
      else if (targetStatus === "fail") activeClass = "bg-red-600 text-white border-red-600";
      else if (targetStatus === "pending") activeClass = "bg-yellow-400 text-black border-yellow-400";
      else activeClass = "bg-gray-400 text-white border-gray-400";
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg font-black uppercase text-base min-w-[80px] ${activeClass}`}
      >
        <Icon className="w-5 h-5" />
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-100 p-6 rounded-xl border-4 border-black shadow-brutal">
        <div>
          <h2 className="text-2xl font-black uppercase">Standard Inspection</h2>
          <p className="text-gray-600 font-medium mt-1">
            Tap to set status. Failed items auto-add to the to-do list on save.
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="w-full sm:w-auto"
        >
          <Save className="w-6 h-6 mr-2" />
          {isPending ? "SAVING..." : "SAVE CHANGES"}
        </Button>
      </div>

      {savedMessage && (
        <div className="bg-black text-white font-bold text-lg p-4 rounded-xl text-center">
          {savedMessage}
        </div>
      )}

      <div className="space-y-12">
        {INSPECTION_CATEGORIES.map(category => {
          const categoryItems = localItems
            .map((item, index) => ({ item, index }))
            .filter(x => x.item.category === category);

          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="space-y-4">
              <h3 className="text-3xl font-black border-b-4 border-black pb-2">{category}</h3>
              <div className="space-y-4">
                {categoryItems.map(({ item, index }) => {
                  const isFail = item.status === "fail";
                  return (
                    <div
                      key={index}
                      className={`flex flex-col xl:flex-row gap-4 p-6 border-2 rounded-xl transition-colors ${
                        isFail ? "border-red-600 bg-red-50" : "border-black bg-white"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-xl font-bold">{item.item}</div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <StatusButton
                            currentStatus={item.status || "pending"}
                            targetStatus={UpsertInspectionItemStatus.pass}
                            onClick={() => handleStatusChange(index, UpsertInspectionItemStatus.pass)}
                            icon={CheckCircle2}
                            label="PASS"
                          />
                          <StatusButton
                            currentStatus={item.status || "pending"}
                            targetStatus={UpsertInspectionItemStatus.fail}
                            onClick={() => handleStatusChange(index, UpsertInspectionItemStatus.fail)}
                            icon={AlertCircle}
                            label="FAIL"
                          />
                          <StatusButton
                            currentStatus={item.status || "pending"}
                            targetStatus={UpsertInspectionItemStatus.na}
                            onClick={() => handleStatusChange(index, UpsertInspectionItemStatus.na)}
                            icon={HelpCircle}
                            label="N/A"
                          />
                          <StatusButton
                            currentStatus={item.status || "pending"}
                            targetStatus={UpsertInspectionItemStatus.pending}
                            onClick={() => handleStatusChange(index, UpsertInspectionItemStatus.pending)}
                            icon={Clock}
                            label="PENDING"
                          />
                        </div>
                      </div>
                      <div className="xl:w-1/3 flex items-end">
                        <Input
                          placeholder="Add notes..."
                          value={item.notes || ""}
                          onChange={e => handleNotesChange(index, e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
