import { useState, useEffect } from "react";
import { 
  useGetInspection, 
  useUpsertInspection, 
  UpsertInspectionItemStatus,
  InspectionItem
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { INSPECTION_TEMPLATE, INSPECTION_CATEGORIES, buildDefaultInspection } from "@/lib/inspection-template";
import { Save, AlertCircle, CheckCircle2, HelpCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

export function InspectionsTab({ carId }: { carId: number }) {
  const { data: inspectionItems, isLoading, isError } = useGetInspection(carId);
  const { mutate: upsertInspection, isPending } = useUpsertInspection();
  
  const [localItems, setLocalItems] = useState<Partial<InspectionItem>[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (inspectionItems) {
      if (inspectionItems.length === 0) {
        setLocalItems(buildDefaultInspection());
      } else {
        setLocalItems(inspectionItems);
      }
      setIsDirty(false);
    }
  }, [inspectionItems]);

  if (isLoading) return <div className="p-12 text-center text-2xl font-bold">Loading inspection...</div>;
  if (isError) return <div className="p-12 text-center text-2xl font-bold text-destructive">Error loading inspection.</div>;

  const handleStatusChange = (index: number, status: UpsertInspectionItemStatus) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], status };
    setLocalItems(newItems);
    setIsDirty(true);
  };

  const handleNotesChange = (index: number, notes: string) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], notes };
    setLocalItems(newItems);
    setIsDirty(true);
  };

  const handleSave = () => {
    // Make sure we only send what's required by UpsertInspectionItem
    const payload = localItems.map(item => ({
      id: item.id,
      category: item.category || "Unknown",
      item: item.item || "Unknown",
      status: item.status as UpsertInspectionItemStatus,
      notes: item.notes || ""
    }));
    
    upsertInspection({ carId, data: payload }, {
      onSuccess: () => {
        setIsDirty(false);
        // Toast could go here
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
    currentStatus: string, 
    targetStatus: UpsertInspectionItemStatus, 
    onClick: () => void,
    icon: any,
    label: string
  }) => {
    const isActive = currentStatus === targetStatus;
    
    let activeColor: "pass" | "fail" | "pending" | "na" = "na";
    if (targetStatus === "pass") activeColor = "pass";
    if (targetStatus === "fail") activeColor = "fail";
    if (targetStatus === "pending") activeColor = "pending";
    
    return (
      <Button
        variant={isActive ? "status" : "outline"}
        statusColor={isActive ? activeColor : undefined}
        onClick={onClick}
        className="flex-1 md:flex-none justify-center gap-2 px-3"
      >
        <Icon className="w-5 h-5 hidden sm:block" />
        {label}
      </Button>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary p-6 rounded-xl border-4 border-black shadow-brutal">
        <div>
          <h2 className="text-2xl font-black uppercase">Standard Inspection</h2>
          <p className="text-muted-foreground font-medium mt-1">
            Tap to toggle status. Changes must be saved.
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

      <div className="space-y-12">
        {INSPECTION_CATEGORIES.map(category => {
          const categoryItems = localItems.map((item, index) => ({ item, index }))
                                          .filter(x => x.item.category === category);
          
          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="space-y-4">
              <h3 className="text-3xl font-black border-b-4 border-black pb-2">{category}</h3>
              <div className="space-y-4">
                {categoryItems.map(({ item, index }) => (
                  <div key={index} className="flex flex-col xl:flex-row gap-4 p-6 border-2 border-black rounded-xl bg-card shadow-brutal-sm transition-colors hover:border-black hover:shadow-brutal">
                    <div className="flex-1">
                      <div className="text-xl font-bold">{item.item}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
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
                        onChange={(e) => handleNotesChange(index, e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
