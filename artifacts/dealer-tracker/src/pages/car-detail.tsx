import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetCar, useUpdateCar, useDeleteCar, CreateCarStatus, CreateCarCarType, CreateCarVehicleType, CreateCarVehicleSubtype } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InspectionsTab } from "@/components/inspections-tab";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { MileageTab } from "@/components/mileage-tab";
import { TodosTab } from "@/components/todos-tab";
import { CostsTab } from "@/components/costs-tab";
import { ArrowLeft, Edit2, Trash2, Key, Gauge, Tag, User, Phone, Mail, EyeOff } from "lucide-react";
import { vinLabel, mileageLabel } from "@/lib/vehicle-labels";
import { getSubtypesForVehicleType, getDefaultSubtype, vehicleSubtypeLabel } from "@/lib/inspection-template";

function statusBadge(status?: string | null) {
  switch (status) {
    case "in_service":
      return <span className="bg-blue-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">In Service</span>;
    case "ready":
      return <span className="bg-green-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">Ready</span>;
    case "on_hold":
      return <span className="bg-amber-500 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">On Hold</span>;
    default:
      return null;
  }
}

const STATUS_OPTIONS = [
  { value: "", label: "— No Status —" },
  { value: "in_service", label: "In Service" },
  { value: "ready", label: "Ready" },
  { value: "on_hold", label: "On Hold" },
];

const TYPE_OPTIONS = [
  { value: "dealer", label: "Dealership" },
  { value: "personal", label: "Personal" },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: "car",        label: "Car / Truck" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "boat",       label: "Boat" },
  { value: "atv",        label: "ATV / UTV" },
];


function vehicleTypeBadge(vt?: string | null, subtype?: string | null) {
  if (!vt) return null;
  const label = vehicleSubtypeLabel(vt, subtype);
  if (!label) return null;
  return <span className="bg-slate-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">{label}</span>;
}

const emptyEditForm = {
  stockNumber: "",
  year: "",
  make: "",
  model: "",
  vin: "",
  color: "",
  mileage: "",
  status: "",
  carType: "dealer" as "dealer" | "personal",
  vehicleType: "car" as "car" | "motorcycle" | "boat" | "atv",
  vehicleSubtype: "sedan" as string,
  owner: "",
};

export default function CarDetail() {
  const [, params] = useRoute("/cars/:id");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : 0;

  const queryClient = useQueryClient();
  const { data: car, isLoading, isError } = useGetCar(carId);
  const { mutate: updateCar, isPending: isUpdating } = useUpdateCar();
  const { mutate: deleteCar } = useDeleteCar();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState("");

  const openEditDialog = () => {
    if (car) {
      const vt = (car.vehicleType as "car" | "motorcycle" | "boat" | "atv") ?? "car";
      setEditForm({
        stockNumber: car.stockNumber,
        year: String(car.year),
        make: car.make,
        model: car.model,
        vin: car.vin || "",
        color: car.color || "",
        mileage: car.mileage != null ? String(car.mileage) : "",
        status: car.status || "",
        carType: (car.carType === "personal" ? "personal" : "dealer") as "dealer" | "personal",
        vehicleType: vt,
        vehicleSubtype: car.vehicleSubtype || getDefaultSubtype(vt),
        owner: car.owner || "",
      });
      setEditError("");
      setDialogOpen(true);
    }
  };

  const handleEditSave = () => {
    if (!editForm.stockNumber.trim()) { setEditError("Stock number is required."); return; }
    if (!editForm.year.trim() || isNaN(Number(editForm.year))) { setEditError("A valid year is required."); return; }
    if (!editForm.make.trim()) { setEditError("Make is required."); return; }
    if (!editForm.model.trim()) { setEditError("Model is required."); return; }
    setEditError("");
    const data = {
      stockNumber: editForm.stockNumber.trim(),
      year: parseInt(editForm.year, 10),
      make: editForm.make.trim(),
      model: editForm.model.trim(),
      vin: editForm.vin.trim() || undefined,
      color: editForm.color.trim() || undefined,
      mileage: editForm.mileage.trim() ? parseInt(editForm.mileage.trim(), 10) : undefined,
      status: (editForm.status || null) as unknown as CreateCarStatus | undefined,
      carType: editForm.carType as CreateCarCarType,
      vehicleType: editForm.vehicleType as CreateCarVehicleType,
      vehicleSubtype: editForm.vehicleSubtype as CreateCarVehicleSubtype,
      owner: editForm.carType === "personal" && editForm.owner.trim() ? editForm.owner.trim() : undefined,
    };
    updateCar({ carId, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/cars`] });
        setDialogOpen(false);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to save changes.";
        setEditError(msg);
      },
    });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${car?.year} ${car?.make} ${car?.model}? This will remove all logs and inspections permanently.`)) {
      deleteCar({ carId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars`] });
          setLocation("/");
        }
      });
    }
  };

  const handleToggleSold = () => {
    if (!car) return;
    const isSold = Boolean(car?.sold);
    const confirmMsg = isSold
      ? `Mark ${car?.year} ${car?.make} ${car?.model} as active again?`
      : `Mark ${car?.year} ${car?.make} ${car?.model} as sold? It will move to the Sold Vehicles list.`;
    if (confirm(confirmMsg)) {
      updateCar({ carId, data: {
        stockNumber: car.stockNumber,
        year: car.year,
        make: car.make,
        model: car.model,
        vin: car.vin || undefined,
        color: car.color || undefined,
        mileage: car.mileage ?? undefined,
        status: (car.status || undefined) as CreateCarStatus | undefined,
        carType: (car.carType || "dealer") as CreateCarCarType,
        vehicleType: (car.vehicleType || "car") as CreateCarVehicleType,
        vehicleSubtype: (car.vehicleSubtype || undefined) as CreateCarVehicleSubtype | undefined,
        owner: car.owner || undefined,
        sold: isSold ? 0 : 1,
      } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars`] });
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}`] });
          if (!isSold) setLocation("/");
        }
      });
    }
  };

  const setEditVehicleType = (vt: string) => {
    setEditForm(f => ({
      ...f,
      vehicleType: vt as typeof f.vehicleType,
      vehicleSubtype: getDefaultSubtype(vt),
    }));
  };

  const editSubtypeOptions = getSubtypesForVehicleType(editForm.vehicleType);

  // Mechanic contact info
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  type ContactInfo = { id: number; displayName: string; phone: string | null; email: string | null; contactPublic: boolean; visible: boolean };
  const [contact, setContact] = useState<ContactInfo | null>(null);

  const viewerSession = (() => {
    try { return JSON.parse(localStorage.getItem("dt_mechanic") || "{}") as { mechanicId?: number; isAdmin?: boolean }; }
    catch { return {}; }
  })();

  useEffect(() => {
    if (!car?.mechanicId) return;
    // Only fetch contact if admin or the car belongs to someone else (no-op for own car — they already know their own info)
    fetch(`${BASE}/api/mechanics/${car.mechanicId}/contact`, {
      headers: { "X-Mechanic-Id": String(viewerSession.mechanicId ?? "") },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: ContactInfo | null) => setContact(data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car?.mechanicId]);

  if (isLoading) return <Layout><div className="text-center py-20 text-3xl font-black">Loading vehicle data...</div></Layout>;
  if (isError || !car) return <Layout><div className="text-center py-20 text-3xl font-black text-destructive">Vehicle not found.</div></Layout>;

  return (
    <Layout>
      <div className="mb-8">
        <Button variant="ghost" onClick={() => setLocation("/")} className="mb-6 -ml-4">
          <ArrowLeft className="w-6 h-6 mr-2" />
          BACK TO VEHICLES
        </Button>

        <div className="bg-white border-4 border-black rounded-2xl p-6 sm:p-8 shadow-brutal flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="bg-black text-white font-mono font-bold px-4 py-2 rounded-lg text-2xl shadow-brutal-sm">
                #{car.stockNumber}
              </span>
              <h1 className="text-4xl sm:text-5xl font-black uppercase">
                {car.year} {car.make} {car.model}
              </h1>
              {statusBadge(car.status)}
              {car.carType === "personal" && (
                <span className="bg-teal-700 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">Personal</span>
              )}
              {vehicleTypeBadge(car.vehicleType, car.vehicleSubtype)}
            </div>

            <div className="flex flex-wrap gap-6 mt-4 font-mono text-xl font-bold">
              {car.carType === "personal" && car.owner && (
                <div className="flex items-center gap-2 text-teal-700">
                  <User className="w-6 h-6" />
                  {car.owner}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Key className="w-6 h-6 text-muted-foreground" />
                {car.vin || vinLabel(car.vehicleType).empty}
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="w-6 h-6 text-muted-foreground" />
                {car.mileage ? `${car.mileage.toLocaleString()} ${mileageLabel(car.vehicleType).unit}` : mileageLabel(car.vehicleType).empty}
              </div>
              {car.color && (
                <div className="flex items-center gap-2 font-sans uppercase bg-secondary px-3 py-1 rounded-md border-2 border-black">
                  COLOR: {car.color}
                </div>
              )}
            </div>
          </div>

          <div className="flex md:flex-col gap-4 min-w-[140px]">
            <Button variant="outline" size="lg" className="flex-1" onClick={openEditDialog}>
              <Edit2 className="w-5 h-5 mr-2" /> EDIT
            </Button>
            <Button
              type="button"
              size="lg"
              className={`flex-1 border-4 font-black text-sm ${car.sold ? "bg-green-600 border-green-600 text-white" : "bg-gray-500 border-gray-500 text-white"}`}
              disabled={isUpdating}
              onClick={handleToggleSold}
            >
              <Tag className="w-5 h-5 mr-2 flex-shrink-0" />
              {car.sold ? (
                "UNSELL"
              ) : (
                <span className="leading-tight text-center">MARK<br />SOLD</span>
              )}
            </Button>
            <Button variant="destructive" size="lg" className="flex-1 border-destructive text-white" onClick={handleDelete}>
              <Trash2 className="w-5 h-5 mr-2" /> DELETE
            </Button>
          </div>
        </div>
      </div>

      {contact && contact.id !== viewerSession.mechanicId && (
        <div className={`mb-6 rounded-2xl border-4 px-6 py-4 flex flex-wrap items-center gap-4 ${
          contact.visible
            ? "bg-blue-50 border-blue-700"
            : "bg-gray-100 border-gray-400"
        }`}>
          <div className="flex items-center gap-2">
            <User className={`w-5 h-5 ${contact.visible ? "text-blue-800" : "text-gray-500"}`} />
            <span className={`font-black uppercase text-lg ${contact.visible ? "text-blue-900" : "text-gray-600"}`}>
              {contact.displayName}
            </span>
          </div>
          {contact.visible && contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 font-bold text-blue-900 underline text-lg">
              <Phone className="w-5 h-5" /> {contact.phone}
            </a>
          )}
          {contact.visible && contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 font-bold text-blue-900 underline text-lg">
              <Mail className="w-5 h-5" /> {contact.email}
            </a>
          )}
          {contact.visible && !contact.phone && !contact.email && (
            <span className="font-bold text-blue-700">No contact info on file.</span>
          )}
          {!contact.visible && (
            <span className="flex items-center gap-2 font-bold text-gray-500">
              <EyeOff className="w-4 h-4" /> Contact info is private
            </span>
          )}
        </div>
      )}

      <Tabs defaultValue="inspection" className="w-full">
        <TabsList className="flex flex-col sm:flex-row h-auto border-b-0 gap-2 sm:gap-4 mb-8">
          <TabsTrigger value="inspection" className="w-full sm:w-auto">INSPECTION</TabsTrigger>
          <TabsTrigger value="maintenance" className="w-full sm:w-auto">MAINTENANCE</TabsTrigger>
          <TabsTrigger value="todos" className="w-full sm:w-auto">NEEDS DONE</TabsTrigger>
          <TabsTrigger value="mileage" className="w-full sm:w-auto">MILEAGE</TabsTrigger>
          <TabsTrigger value="costs" className="w-full sm:w-auto">COSTS</TabsTrigger>
        </TabsList>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border-4 border-black shadow-brutal min-h-[500px]">
          <TabsContent value="inspection" className="mt-0">
            <InspectionsTab carId={carId} carLabel={`${car.year} ${car.make} ${car.model} #${car.stockNumber}`} vehicleType={car.vehicleType} vehicleSubtype={car.vehicleSubtype} />
          </TabsContent>
          <TabsContent value="maintenance" className="mt-0">
            <MaintenanceTab carId={carId} carLabel={`${car.year} ${car.make} ${car.model} #${car.stockNumber}`} />
          </TabsContent>
          <TabsContent value="todos" className="mt-0">
            <TodosTab carId={carId} carLabel={`${car.year} ${car.make} ${car.model} #${car.stockNumber}`} />
          </TabsContent>
          <TabsContent value="mileage" className="mt-0">
            <MileageTab carId={carId} carLabel={`${car.year} ${car.make} ${car.model} #${car.stockNumber}`} initialMileage={car.mileage ?? undefined} originalMileage={car.originalMileage ?? undefined} vehicleType={car.vehicleType} />
          </TabsContent>
          <TabsContent value="costs" className="mt-0">
            <CostsTab
              carId={carId}
              carLabel={`${car.year} ${car.make} ${car.model} #${car.stockNumber}`}
              repairNotes={car.repairNotes ?? undefined}
              partsCost={car.partsCost ?? undefined}
              laborHours={car.laborHours ?? undefined}
              laborRate={car.laborRate ?? undefined}
              actualRepairNotes={car.actualRepairNotes ?? undefined}
              actualPartsCost={car.actualPartsCost ?? undefined}
              actualLaborHours={car.actualLaborHours ?? undefined}
            />
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>EDIT VEHICLE DETAILS</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Stock Number *</label>
                <Input
                  className="bg-white text-black"
                  value={editForm.stockNumber}
                  onChange={e => setEditForm(f => ({ ...f, stockNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">{vinLabel(editForm.vehicleType).label}</label>
                <Input
                  className="font-mono bg-white text-black"
                  value={editForm.vin}
                  placeholder={vinLabel(editForm.vehicleType).placeholder}
                  onChange={e => setEditForm(f => ({ ...f, vin: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Year *</label>
                <Input
                  inputMode="numeric"
                  className="bg-white text-black"
                  value={editForm.year}
                  onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Make *</label>
                <Input
                  className="bg-white text-black"
                  value={editForm.make}
                  onChange={e => setEditForm(f => ({ ...f, make: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Model *</label>
                <Input
                  className="bg-white text-black"
                  value={editForm.model}
                  onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">{mileageLabel(editForm.vehicleType).label}</label>
                <Input
                  inputMode="numeric"
                  className="bg-white text-black"
                  value={editForm.mileage}
                  onChange={e => setEditForm(f => ({ ...f, mileage: e.target.value }))}
                  placeholder="e.g. 47500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Color</label>
                <Input
                  className="bg-white text-black"
                  value={editForm.color}
                  onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Type</label>
              <div className="flex gap-3">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, carType: opt.value as "dealer" | "personal" }))}
                    className={`flex-1 px-4 py-3 rounded-xl border-4 font-black uppercase text-base transition-colors ${
                      editForm.carType === opt.value
                        ? opt.value === "personal"
                          ? "bg-teal-700 text-white border-teal-700"
                          : "bg-black text-white border-black"
                        : "bg-white text-black border-black"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {editForm.carType === "personal" && (
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Owner Name</label>
                <Input
                  className="bg-white text-black"
                  value={editForm.owner}
                  placeholder="e.g. John Smith"
                  onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Vehicle Type</label>
              <div className="grid grid-cols-2 gap-3">
                {VEHICLE_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditVehicleType(opt.value)}
                    className={`px-4 py-3 rounded-xl border-4 font-black uppercase text-base transition-colors ${
                      editForm.vehicleType === opt.value
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-black"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">
                {editForm.vehicleType === "car" ? "Body Style" : editForm.vehicleType === "motorcycle" ? "Motorcycle Type" : editForm.vehicleType === "boat" ? "Boat Type" : "ATV / UTV Type"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {editSubtypeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, vehicleSubtype: opt.value }))}
                    className={`px-4 py-3 rounded-xl border-4 font-black uppercase text-sm transition-colors ${
                      editForm.vehicleSubtype === opt.value
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-black"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-lg font-bold uppercase">Status</label>
              <div className="flex flex-wrap gap-3">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, status: opt.value }))}
                    className={`px-4 py-2 rounded-lg border-4 font-black uppercase text-sm transition-colors ${
                      editForm.status === opt.value
                        ? opt.value === "in_service"
                          ? "bg-blue-600 text-white border-blue-600"
                          : opt.value === "ready"
                          ? "bg-green-600 text-white border-green-600"
                          : opt.value === "on_hold"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-black text-white border-black"
                        : "bg-white text-black border-black"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {editError && <p className="text-destructive font-bold text-lg">{editError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
              <Button type="button" size="lg" disabled={isUpdating} onClick={handleEditSave}>
                {isUpdating ? "SAVING..." : "SAVE CHANGES"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
