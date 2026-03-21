import { useState, useEffect, useRef } from "react";
import {
  useGetInspection,
  useUpsertInspection,
  useCreateTodo,
  UpsertInspectionItemStatus,
  InspectionItem,
  CreateTodoEntryPriority,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { INSPECTION_CATEGORIES, buildDefaultInspection } from "@/lib/inspection-template";
import { Save, AlertCircle, CheckCircle2, HelpCircle, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function InspectionsTab({ carId }: { carId: number }) {
  const queryClient = useQueryClient();
  const { data: inspectionItems, isLoading, isError } = useGetInspection(carId);
  const { mutate: upsertInspection, isPending } = useUpsertInspection();
  const { mutate: createTodo } = useCreateTodo();

  const [localItems, setLocalItems] = useState<Partial<InspectionItem>[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  // Tracks the last-saved server state so we can detect newly-failed items per save.
  // Updated both on initial load and after each successful save.
  const serverStateRef = useRef<Partial<InspectionItem>[]>([]);

  useEffect(() => {
    if (inspectionItems) {
      const items = inspectionItems.length === 0 ? buildDefaultInspection() : inspectionItems;
      setLocalItems(items);
      serverStateRef.current = items;
      setIsDirty(false);
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
      notes: item.notes || "",
    }));

    // Find items that changed TO "fail" compared to the last server state.
    // This means: currently fail AND (server didn't have it, OR server had it as non-fail).
    const newlyFailed = localItems.filter(item => {
      if (item.status !== "fail" || !item.item) return false;
      const serverItem = serverStateRef.current.find(
        s => s.item === item.item && s.category === item.category
      );
      // Only create a todo if it wasn't already "fail" on the server
      return serverItem?.status !== "fail";
    });

    upsertInspection({ carId, data: payload }, {
      onSuccess: () => {
        // Update our baseline to the newly-saved state so future saves compare correctly
        serverStateRef.current = localItems.map(item => ({ ...item }));
        setIsDirty(false);

        if (newlyFailed.length > 0) {
          let completed = 0;
          newlyFailed.forEach(item => {
            // Description: "Diagnose: [notes]" or "Diagnose: [item name]" if no notes
            const notesText = (item.notes || "").trim();
            const description = notesText
              ? `Diagnose: ${notesText}`
              : `Diagnose: ${item.category} - ${item.item}`;

            createTodo({
              carId,
              data: {
                description,
                priority: CreateTodoEntryPriority.high,
                notes: `${item.category}: ${item.item}`,
                completed: false,
              },
            }, {
              onSuccess: () => {
                completed++;
                queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/todos`] });
                if (completed === newlyFailed.length) {
                  setSavedMessage(
                    `Saved. ${newlyFailed.length} failed item${newlyFailed.length > 1 ? "s" : ""} added to Needs Done.`
                  );
                  setTimeout(() => setSavedMessage(""), 5000);
                }
              },
              onError: () => {
                setSavedMessage("Inspection saved, but failed to create some to-do items.");
                setTimeout(() => setSavedMessage(""), 5000);
              },
            });
          });
        } else {
          setSavedMessage("Saved.");
          setTimeout(() => setSavedMessage(""), 3000);
        }
      },
    });
  };

  const StatusButton = ({
    currentStatus,
    targetStatus,
    onClick,
    icon: Icon,
    label,
  }: {
    currentStatus: string;
    targetStatus: UpsertInspectionItemStatus;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
  }) => {
    const isActive = currentStatus === targetStatus;
    let activeClass = "bg-white border-black text-black";
    if (isActive) {
      if (targetStatus === "pass") activeClass = "bg-green-600 text-white border-green-600";
      else if (targetStatus === "fail") activeClass = "bg-red-600 text-white border-red-600";
      else if (targetStatus === "pending") activeClass = "bg-yellow-400 text-black border-yellow-400";
      else activeClass = "bg-blue-500 text-white border-blue-500";
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
            Failed items are added to Needs Done on save.
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
                        isFail
                          ? "border-red-600 bg-red-50"
                          : item.status === "pass"
                          ? "border-green-600 bg-green-50"
                          : "border-black bg-white"
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
                      <div className="xl:w-1/3 flex flex-col justify-end gap-1">
                        {isFail && (
                          <p className="text-sm font-bold text-red-600 uppercase">
                            Notes → Diagnose description
                          </p>
                        )}
                        <Textarea
                          placeholder={isFail ? "What was found? (added to Needs Done)" : "Add notes..."}
                          value={item.notes || ""}
                          onChange={e => handleNotesChange(index, e.target.value)}
                          rows={3}
                          className={`w-full ${isFail ? "border-red-600 border-2" : ""}`}
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
