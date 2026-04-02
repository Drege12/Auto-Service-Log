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
import {
  getCategoriesForVehicleType,
  buildDefaultInspection,
  DRIVER_INSPECTION_CATEGORIES,
  buildDefaultDriverInspection,
  getDriverCategoriesForVehicleType,
} from "@/lib/inspection-template";
import { Save, AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Clock, ChevronDown, ChevronRight, Printer, Car, Eye } from "lucide-react";
import { printInspection } from "@/lib/print-utils";
import { Textarea } from "@/components/ui/textarea";

export function InspectionsTab({
  carId,
  carLabel,
  vehicleType,
  vehicleSubtype,
  userRole,
  isOwnCar,
}: {
  carId: number;
  carLabel: string;
  vehicleType?: string | null;
  vehicleSubtype?: string | null;
  userRole?: string;
  isOwnCar?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: inspectionItems, isLoading, isError } = useGetInspection(carId);
  const { mutate: upsertInspection, isPending } = useUpsertInspection();
  const { mutate: createTodo } = useCreateTodo();

  const isDriver = userRole === "driver";

  const [localItems, setLocalItems] = useState<Partial<InspectionItem>[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [mechanicSectionOpen, setMechanicSectionOpen] = useState(true);
  const [driverReviewItems, setDriverReviewItems] = useState<Partial<InspectionItem>[]>([]);
  const [driverReviewOpen, setDriverReviewOpen] = useState<Set<string>>(new Set());
  // Editable driver/operator items for mechanics viewing their own (non-client) cars
  const [ownDriverItems, setOwnDriverItems] = useState<Partial<InspectionItem>[]>([]);
  const [ownDriverOpen, setOwnDriverOpen] = useState<Set<string>>(new Set());
  const [ownDriverSectionOpen, setOwnDriverSectionOpen] = useState(false);

  // Holds all items from the server (both driver and mechanic) so saves don't clobber the other role
  const allServerItemsRef = useRef<Partial<InspectionItem>[]>([]);
  const serverStateRef = useRef<Partial<InspectionItem>[]>([]);

  useEffect(() => {
    if (inspectionItems) {
      allServerItemsRef.current = inspectionItems;

      if (isDriver) {
        const driverItems = inspectionItems.filter(i =>
          DRIVER_INSPECTION_CATEGORIES.includes(i.category || "")
        );
        const items = driverItems.length === 0 ? buildDefaultDriverInspection(vehicleType, vehicleSubtype) : driverItems;
        setLocalItems(items);
        serverStateRef.current = items;
      } else {
        const mechanicItems = inspectionItems.filter(i =>
          !DRIVER_INSPECTION_CATEGORIES.includes(i.category || "")
        );
        const items = mechanicItems.length === 0
          ? buildDefaultInspection(vehicleType, vehicleSubtype)
          : mechanicItems;
        setLocalItems(items);
        serverStateRef.current = items;

        // Start all mechanic categories open
        const cats = new Set(items.map(i => i.category || "").filter(Boolean));
        setOpenSections(cats);

        if (isOwnCar) {
          // For mechanic viewing their own car: load driver items as editable
          const driverItems = inspectionItems.filter(i =>
            DRIVER_INSPECTION_CATEGORIES.includes(i.category || "")
          );
          const ownItems = driverItems.length === 0
            ? buildDefaultDriverInspection(vehicleType, vehicleSubtype)
            : driverItems;
          setOwnDriverItems(ownItems);
        } else {
          // Populate read-only driver review panel (client cars)
          const driverItems = inspectionItems.filter(i =>
            DRIVER_INSPECTION_CATEGORIES.includes(i.category || "")
          );
          setDriverReviewItems(driverItems);
        }
      }
      setIsDirty(false);
    }
  }, [inspectionItems, isDriver, isOwnCar]);

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading inspection...</div>;
  if (isError) return <div className="p-12 text-center text-2xl font-bold text-red-600">Error loading inspection.</div>;

  const toggleSection = (category: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const toggleDriverSection = (category: string) => {
    setDriverReviewOpen(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const driverStatusBadge = (status?: string | null) => {
    switch (status) {
      case "pass":     return <span className="bg-green-600 text-white font-black px-3 py-1 rounded text-sm uppercase">Pass</span>;
      case "fail":     return <span className="bg-red-600 text-white font-black px-3 py-1 rounded text-sm uppercase">Fail</span>;
      case "advisory": return <span className="bg-orange-500 text-white font-black px-3 py-1 rounded text-sm uppercase">Advisory</span>;
      case "na":       return <span className="bg-blue-500 text-white font-black px-3 py-1 rounded text-sm uppercase">N/A</span>;
      default:         return <span className="bg-gray-300 text-black font-black px-3 py-1 rounded text-sm uppercase">Pending</span>;
    }
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

  const handleOwnDriverStatusChange = (index: number, status: UpsertInspectionItemStatus) => {
    const newItems = [...ownDriverItems];
    newItems[index] = { ...newItems[index], status };
    setOwnDriverItems(newItems);
    setIsDirty(true);
    setSavedMessage("");
  };

  const handleOwnDriverNotesChange = (index: number, notes: string) => {
    const newItems = [...ownDriverItems];
    newItems[index] = { ...newItems[index], notes };
    setOwnDriverItems(newItems);
    setIsDirty(true);
    setSavedMessage("");
  };

  const toggleOwnDriverCategory = (category: string) => {
    setOwnDriverOpen(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const handleSave = () => {
    // For mechanic's own car: save both mechanic items and editable driver items together
    // For client cars: preserve driver items from server (read-only, not edited here)
    // For drivers: preserve mechanic items from server
    let otherRoleItems: Partial<InspectionItem>[];
    if (isOwnCar) {
      otherRoleItems = []; // ownDriverItems already included below
    } else if (isDriver) {
      otherRoleItems = allServerItemsRef.current.filter(i => !DRIVER_INSPECTION_CATEGORIES.includes(i.category || ""));
    } else {
      otherRoleItems = allServerItemsRef.current.filter(i => DRIVER_INSPECTION_CATEGORIES.includes(i.category || ""));
    }

    const ownDriverPayload = isOwnCar ? ownDriverItems : [];

    const payload = [...localItems, ...otherRoleItems, ...ownDriverPayload].map(item => ({
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
        allServerItemsRef.current = [...localItems, ...otherRoleItems, ...ownDriverPayload];
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

  const displayCategories = isDriver
    ? getDriverCategoriesForVehicleType(vehicleType)
    : getCategoriesForVehicleType(vehicleType, vehicleSubtype);

  return (
    <div className="space-y-6">
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-xl border-4 shadow-brutal ${
        isDriver ? "bg-teal-50 border-teal-600" : "bg-gray-100 border-black"
      }`}>
        <div>
          <h2 className="text-2xl font-black uppercase flex items-center gap-3">
            {isDriver && <Car className="w-7 h-7 text-teal-700" />}
            {isDriver
              ? vehicleType === "motorcycle" ? "Rider Check"
              : vehicleType === "boat" ? "Operator Check"
              : "Driver Check"
              : "Standard Inspection"}
          </h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {(() => {
              const pending = localItems.filter(i => !i.status || i.status === "pending").length;
              const total = localItems.length;
              return pending > 0 ? (
                <span className="bg-yellow-400 text-black text-base font-black px-3 py-1 rounded border-2 border-black">
                  {pending} of {total} items pending
                </span>
              ) : total > 0 ? (
                <span className="bg-green-600 text-white text-base font-black px-3 py-1 rounded border-2 border-black">
                  All {total} items reviewed
                </span>
              ) : null;
            })()}
            <p className={`font-medium ${isDriver ? "text-teal-700" : "text-gray-600"}`}>
              {isDriver
                ? vehicleType === "motorcycle" ? "Pre-ride, while riding, and post-ride checks."
                : vehicleType === "boat" ? "Pre-launch, underway, and post-use checks."
                : "Pre-drive, while driving, and post-drive checks."
                : "Failed items are added to Needs Done on save."}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {!isDriver && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => printInspection(`${carLabel} — Inspection`, localItems.map(i => ({ category: i.category || "", item: i.item || "", status: i.status || "pending", notes: i.notes })), getCategoriesForVehicleType(vehicleType, vehicleSubtype))}
            >
              <Printer className="w-5 h-5 mr-2" /> PRINT
            </Button>
          )}
          <Button
            size="lg"
            onClick={handleSave}
            disabled={!isDirty || isPending}
            className={`w-full sm:w-auto ${isDriver ? "bg-teal-600 hover:bg-teal-700 text-white border-teal-600" : ""}`}
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

      {!isDriver && driverReviewItems.length > 0 && (
        <div className="mt-8 space-y-3">
          <div className="bg-teal-50 border-4 border-teal-600 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-xl font-black uppercase flex items-center gap-2 text-teal-900">
                <Eye className="w-6 h-6" />
                {vehicleType === "motorcycle" ? "Rider's Check — Review"
                  : vehicleType === "boat" ? "Operator's Check — Review"
                  : "Driver's Check — Review"}
              </h3>
              <p className="text-teal-700 font-bold mt-1">Read-only view of what the operator recorded.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(() => {
                const fail = driverReviewItems.filter(i => i.status === "fail").length;
                const advisory = driverReviewItems.filter(i => i.status === "advisory").length;
                const pass = driverReviewItems.filter(i => i.status === "pass").length;
                const pending = driverReviewItems.filter(i => !i.status || i.status === "pending").length;
                return (
                  <>
                    {fail > 0 && <span className="bg-red-600 text-white font-black px-3 py-1 rounded text-sm">{fail} FAIL</span>}
                    {advisory > 0 && <span className="bg-orange-500 text-white font-black px-3 py-1 rounded text-sm">{advisory} ADVISORY</span>}
                    {pass > 0 && <span className="bg-green-600 text-white font-black px-3 py-1 rounded text-sm">{pass} PASS</span>}
                    {pending > 0 && <span className="bg-gray-300 text-black font-black px-3 py-1 rounded text-sm">{pending} PENDING</span>}
                  </>
                );
              })()}
            </div>
          </div>

          {getDriverCategoriesForVehicleType(vehicleType).map(category => {
            const categoryItems = driverReviewItems.filter(i => i.category === category);
            if (categoryItems.length === 0) return null;

            const isOpen = driverReviewOpen.has(category);
            const hasFail = categoryItems.some(i => i.status === "fail");
            const hasAdvisory = categoryItems.some(i => i.status === "advisory");
            const borderColor = hasFail ? "border-red-600" : hasAdvisory ? "border-orange-500" : "border-teal-600";

            return (
              <div key={category} className={`border-4 rounded-xl overflow-hidden ${borderColor}`}>
                <button
                  type="button"
                  onClick={() => toggleDriverSection(category)}
                  className={`w-full flex items-center justify-between gap-4 p-5 text-left font-black uppercase text-xl ${
                    hasFail ? "bg-red-50" : hasAdvisory ? "bg-orange-50" : isOpen ? "bg-teal-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl">{category}</span>
                    <CategorySummary items={categoryItems} />
                  </div>
                  {isOpen ? <ChevronDown className="w-8 h-8 flex-shrink-0" /> : <ChevronRight className="w-8 h-8 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="divide-y-2 divide-black border-t-4 border-teal-600">
                    {categoryItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col sm:flex-row sm:items-start gap-4 p-5 ${
                          item.status === "fail" ? "bg-red-50" : item.status === "advisory" ? "bg-orange-50" : item.status === "pass" ? "bg-green-50" : "bg-white"
                        }`}
                      >
                        <div className="flex-1 flex flex-col gap-2">
                          <span className="text-lg font-bold">{item.item}</span>
                          {item.notes && (
                            <p className="text-base font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg px-3 py-2">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {driverStatusBadge(item.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isOwnCar && !isDriver && ownDriverItems.length > 0 && (
        <div className="mt-6">
          {/* Top-level collapsible section header */}
          <button
            type="button"
            onClick={() => setOwnDriverSectionOpen(v => !v)}
            className="w-full flex items-center justify-between gap-4 p-5 text-left bg-teal-600 text-white rounded-xl font-black uppercase text-xl border-4 border-teal-700 shadow-brutal"
          >
            <div className="flex items-center gap-3">
              <Car className="w-7 h-7" />
              <span>
                {vehicleType === "motorcycle" ? "Rider's Check"
                  : vehicleType === "boat" ? "Operator's Check"
                  : "Driver's Check"}
              </span>
              <span className="text-sm font-bold bg-white text-teal-700 px-2 py-0.5 rounded">
                {ownDriverItems.filter(i => !i.status || i.status === "pending").length > 0
                  ? `${ownDriverItems.filter(i => !i.status || i.status === "pending").length} PENDING`
                  : "ALL REVIEWED"}
              </span>
            </div>
            {ownDriverSectionOpen
              ? <ChevronDown className="w-8 h-8 flex-shrink-0" />
              : <ChevronRight className="w-8 h-8 flex-shrink-0" />}
          </button>

          {ownDriverSectionOpen && (
            <div className="mt-3 space-y-3 pl-0">
              <p className="text-teal-700 font-bold text-base px-2">
                {vehicleType === "motorcycle" ? "Pre-ride, while riding, and post-ride checks."
                  : vehicleType === "boat" ? "Pre-launch, underway, and post-use checks."
                  : "Pre-drive, while driving, and post-drive checks."}
              </p>
              {getDriverCategoriesForVehicleType(vehicleType).map(category => {
                const categoryItems = ownDriverItems
                  .map((item, index) => ({ item, index }))
                  .filter(x => x.item.category === category);
                if (categoryItems.length === 0) return null;

                const isOpen = ownDriverOpen.has(category);
                const hasFail = categoryItems.some(x => x.item.status === "fail");
                const hasAdvisory = categoryItems.some(x => x.item.status === "advisory");
                const borderColor = hasFail ? "border-red-600" : hasAdvisory ? "border-orange-500" : "border-teal-600";

                const resetCategoryToPending = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const newItems = [...ownDriverItems];
                  categoryItems.forEach(({ index }) => {
                    newItems[index] = { ...newItems[index], status: UpsertInspectionItemStatus.pending };
                  });
                  setOwnDriverItems(newItems);
                  setIsDirty(true);
                  setSavedMessage("");
                };

                return (
                  <div key={category} className={`border-4 rounded-xl overflow-hidden ${borderColor}`}>
                    <button
                      type="button"
                      onClick={() => toggleOwnDriverCategory(category)}
                      className={`w-full flex flex-col gap-3 p-5 text-left font-black uppercase text-xl ${
                        hasFail ? "bg-red-50" : hasAdvisory ? "bg-orange-50" : isOpen ? "bg-teal-50" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-2xl">{category}</span>
                        {isOpen ? <ChevronDown className="w-8 h-8 flex-shrink-0" /> : <ChevronRight className="w-8 h-8 flex-shrink-0" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <CategorySummary items={categoryItems.map(x => x.item)} />
                        <span
                          role="button"
                          onClick={resetCategoryToPending}
                          className="bg-gray-200 text-black text-sm font-black px-3 py-2 rounded-lg uppercase"
                        >
                          Reset
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="divide-y-2 divide-teal-200 border-t-4 border-teal-600">
                        {categoryItems.map(({ item, index }) => {
                          const isFail = item.status === "fail";
                          return (
                            <div
                              key={index}
                              className={`flex flex-col xl:flex-row gap-4 p-6 ${
                                isFail ? "bg-red-50"
                                  : item.status === "advisory" ? "bg-orange-50"
                                  : item.status === "pass" ? "bg-green-50"
                                  : "bg-white"
                              }`}
                            >
                              <div className="flex-1">
                                <div className="text-xl font-bold">{item.item}</div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                  <StatusButton
                                    currentStatus={item.status || "pending"}
                                    targetStatus={UpsertInspectionItemStatus.pass}
                                    onClick={() => handleOwnDriverStatusChange(index, UpsertInspectionItemStatus.pass)}
                                    icon={CheckCircle2}
                                    label="PASS"
                                  />
                                  <StatusButton
                                    currentStatus={item.status || "pending"}
                                    targetStatus={UpsertInspectionItemStatus.fail}
                                    onClick={() => handleOwnDriverStatusChange(index, UpsertInspectionItemStatus.fail)}
                                    icon={AlertCircle}
                                    label="FAIL"
                                  />
                                  <StatusButton
                                    currentStatus={item.status || "pending"}
                                    targetStatus={UpsertInspectionItemStatus.advisory}
                                    onClick={() => handleOwnDriverStatusChange(index, UpsertInspectionItemStatus.advisory)}
                                    icon={AlertTriangle}
                                    label="ADVISORY"
                                  />
                                  <StatusButton
                                    currentStatus={item.status || "pending"}
                                    targetStatus={UpsertInspectionItemStatus.na}
                                    onClick={() => handleOwnDriverStatusChange(index, UpsertInspectionItemStatus.na)}
                                    icon={HelpCircle}
                                    label="N/A"
                                  />
                                  <StatusButton
                                    currentStatus={item.status || "pending"}
                                    targetStatus={UpsertInspectionItemStatus.pending}
                                    onClick={() => handleOwnDriverStatusChange(index, UpsertInspectionItemStatus.pending)}
                                    icon={Clock}
                                    label="PENDING"
                                  />
                                </div>
                              </div>
                              <div className="xl:w-1/3 flex flex-col justify-end gap-1">
                                <Textarea
                                  placeholder="Add notes..."
                                  value={item.notes || ""}
                                  onChange={e => handleOwnDriverNotesChange(index, e.target.value)}
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
          )}
        </div>
      )}

      {!isDriver && (
        <button
          type="button"
          onClick={() => setMechanicSectionOpen(v => !v)}
          className="w-full flex items-center justify-between gap-4 p-5 text-left bg-black text-white rounded-xl font-black uppercase text-xl border-4 border-black shadow-brutal"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span>Inspection Checklist</span>
            <span className="text-sm font-bold bg-white text-black px-2 py-0.5 rounded">
              {localItems.filter(i => !i.status || i.status === "pending").length > 0
                ? `${localItems.filter(i => !i.status || i.status === "pending").length} PENDING`
                : localItems.length > 0 ? "ALL REVIEWED" : ""}
            </span>
          </div>
          {mechanicSectionOpen
            ? <ChevronDown className="w-8 h-8 flex-shrink-0" />
            : <ChevronRight className="w-8 h-8 flex-shrink-0" />}
        </button>
      )}

      {(isDriver || mechanicSectionOpen) && (
      <div className="space-y-3">
        {displayCategories.map(category => {
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

          const borderColor = hasFail
            ? "border-red-600"
            : hasAdvisory
            ? "border-orange-500"
            : isDriver
            ? "border-teal-600"
            : "border-black";

          return (
            <div key={category} className={`border-4 rounded-xl overflow-hidden ${borderColor}`}>
              <button
                type="button"
                onClick={() => toggleSection(category)}
                className={`w-full flex flex-col gap-3 p-5 text-left font-black uppercase text-xl ${
                  hasFail
                    ? "bg-red-50"
                    : hasAdvisory
                    ? "bg-orange-50"
                    : isOpen
                    ? isDriver ? "bg-teal-50" : "bg-gray-100"
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
                              Notes → added to Needs Done
                            </p>
                          )}
                          <Textarea
                            placeholder={isFail ? "What was found?" : "Add notes..."}
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
      )}
    </div>
  );
}
