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
import { getCategoriesForVehicleType, buildDefaultInspection } from "@/lib/inspection-template";
import { Save, AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Clock, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { printInspection } from "@/lib/print-utils";
import { Textarea } from "@/components/ui/textarea";

export function InspectionsTab({ carId, carLabel, vehicleType, vehicleSubtype }: { carId: number; carLabel: string; vehicleType?: string | null; vehicleSubtype?: string | null }) {
  const queryClient = useQueryClient();
  const { data: inspectionItems, isLoading, isError } = useGetInspection(carId);
  const { mutate: upsertInspection, isPending } = useUpsertInspection();
  const { mutate: createTodo } = useCreateTodo();

  const [localItems, setLocalItems] = useState<Partial<InspectionItem>[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const serverStateRef = useRef<Partial<InspectionItem>[]>([]);

  useEffect(() => {
    if (inspectionItems) {
      const items = inspectionItems.length === 0 ? buildDefaultInspection(vehicleType, vehicleSubtype) : inspectionItems;
      setLocalItems(items);
      serverStateRef.current = items;
      setIsDirty(false);
    }
  }, [inspectionItems]);

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading inspection...</div>;
  if (isError) return <div className="p-12 text-center text-2xl font-bold text-red-600">Error loading inspection.</div>;

  const toggleSection = (category: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

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

    const newlyFailed = localItems.filter(item => {
      if (item.status !== "fail" || !item.item) return false;
      const serverItem = serverStateRef.current.find(
        s => s.item === item.item && s.category === item.category
      );
      return serverItem?.status !== "fail";
    });

    upsertInspection({ carId, data: payload }, {
      onSuccess: () => {
        serverStateRef.current = localItems.map(item => ({ ...item }));
        setIsDirty(false);

        if (newlyFailed.length > 0) {
          let completed = 0;
          newlyFailed.forEach(item => {
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
                  setSavedMessage(`Saved. ${newlyFailed.length} failed item${newlyFailed.length > 1 ? "s" : ""} added to Needs Done.`);
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
      else if (targetStatus === "advisory") activeClass = "bg-orange-500 text-white border-orange-500";
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

  const CategorySummary = ({ items }: { items: Partial<InspectionItem>[] }) => {
    const counts = { pass: 0, fail: 0, advisory: 0, pending: 0, na: 0 };
    items.forEach(i => {
      const s = (i.status || "pending") as keyof typeof counts;
      if (s in counts) counts[s]++;
    });
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {counts.fail > 0 && (
          <span className="bg-red-600 text-white text-sm font-black px-2 py-0.5 rounded">
            {counts.fail} FAIL
          </span>
        )}
        {counts.advisory > 0 && (
          <span className="bg-orange-500 text-white text-sm font-black px-2 py-0.5 rounded">
            {counts.advisory} ADVISORY
          </span>
        )}
        {counts.pass > 0 && (
          <span className="bg-green-600 text-white text-sm font-black px-2 py-0.5 rounded">
            {counts.pass} PASS
          </span>
        )}
        {counts.pending > 0 && (
          <span className="bg-gray-300 text-black text-sm font-black px-2 py-0.5 rounded">
            {counts.pending} PENDING
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-100 p-6 rounded-xl border-4 border-black shadow-brutal">
        <div>
          <h2 className="text-2xl font-black uppercase">Standard Inspection</h2>
          <p className="text-gray-600 font-medium mt-1">
            Failed items are added to Needs Done on save.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => printInspection(`${carLabel} — Inspection`, localItems.map(i => ({ category: i.category || "", item: i.item || "", status: i.status || "pending", notes: i.notes })), getCategoriesForVehicleType(vehicleType, vehicleSubtype))}
          >
            <Printer className="w-5 h-5 mr-2" /> PRINT
          </Button>
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
      </div>

      {savedMessage && (
        <div className="bg-black text-white font-bold text-lg p-4 rounded-xl text-center">
          {savedMessage}
        </div>
      )}

      <div className="space-y-3">
        {getCategoriesForVehicleType(vehicleType, vehicleSubtype).map(category => {
          const categoryItems = localItems
            .map((item, index) => ({ item, index }))
            .filter(x => x.item.category === category);

          if (categoryItems.length === 0) return null;

          const isOpen = openSections.has(category);
          const hasFail = categoryItems.some(x => x.item.status === "fail");
          const hasAdvisory = categoryItems.some(x => x.item.status === "advisory");
          const naButtonLabel: Record<string, string> = {
            "Diesel": "NOT A DIESEL",
            "Hybrid / EV": "NOT A HYBRID/EV",
          };
          const naLabel = naButtonLabel[category];

          const markAllNa = (e: React.MouseEvent) => {
            e.stopPropagation();
            const newItems = [...localItems];
            categoryItems.forEach(({ index }) => {
              newItems[index] = { ...newItems[index], status: UpsertInspectionItemStatus.na };
            });
            setLocalItems(newItems);
            setIsDirty(true);
            setSavedMessage("");
          };

          const resetToPending = (e: React.MouseEvent) => {
            e.stopPropagation();
            const newItems = [...localItems];
            categoryItems.forEach(({ index }) => {
              newItems[index] = { ...newItems[index], status: UpsertInspectionItemStatus.pending };
            });
            setLocalItems(newItems);
            setIsDirty(true);
            setSavedMessage("");
          };

          return (
            <div key={category} className={`border-4 rounded-xl overflow-hidden ${
              hasFail ? "border-red-600" : hasAdvisory ? "border-orange-500" : "border-black"
            }`}>
              <button
                type="button"
                onClick={() => toggleSection(category)}
                className={`w-full flex flex-col gap-3 p-5 text-left font-black uppercase text-xl ${
                  hasFail
                    ? "bg-red-50"
                    : hasAdvisory
                    ? "bg-orange-50"
                    : isOpen
                    ? "bg-gray-100"
                    : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-2xl">{category}</span>
                  {isOpen
                    ? <ChevronDown className="w-8 h-8 flex-shrink-0" />
                    : <ChevronRight className="w-8 h-8 flex-shrink-0" />
                  }
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <CategorySummary items={categoryItems.map(x => x.item)} />
                  {naLabel && (
                    <span
                      role="button"
                      onClick={markAllNa}
                      className="bg-blue-500 text-white text-sm font-black px-3 py-2 rounded-lg uppercase"
                    >
                      {naLabel}
                    </span>
                  )}
                  <span
                    role="button"
                    onClick={resetToPending}
                    className="bg-gray-200 text-black text-sm font-black px-3 py-2 rounded-lg uppercase"
                  >
                    Reset
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="divide-y-2 divide-black border-t-4 border-black">
                  {categoryItems.map(({ item, index }) => {
                    const isFail = item.status === "fail";
                    return (
                      <div
                        key={index}
                        className={`flex flex-col xl:flex-row gap-4 p-6 ${
                          isFail
                            ? "bg-red-50"
                            : item.status === "advisory"
                            ? "bg-orange-50"
                            : item.status === "pass"
                            ? "bg-green-50"
                            : "bg-white"
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
                              targetStatus={UpsertInspectionItemStatus.advisory}
                              onClick={() => handleStatusChange(index, UpsertInspectionItemStatus.advisory)}
                              icon={AlertTriangle}
                              label="ADVISORY"
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
