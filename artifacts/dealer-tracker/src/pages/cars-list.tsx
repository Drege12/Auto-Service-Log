import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListCars, useCreateCar, CreateCarStatus, CreateCarCarType, CreateCarVehicleType, CreateCarVehicleSubtype } from "@workspace/api-client-react";
import { getSubtypesForVehicleType, getDefaultSubtype, vehicleSubtypeLabel } from "@/lib/inspection-template";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Eye, EyeOff, ChevronDown, ChevronUp, Download, UserCheck, Link2, Unlink, Wrench, UserCircle } from "lucide-react";
import { vinLabel, mileageLabel } from "@/lib/vehicle-labels";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type VinMatch = {
  id: number;
  year: number;
  make: string;
  model: string;
  color?: string | null;
  mileage?: number | null;
  vehicleType?: string | null;
  vehicleSubtype?: string | null;
  carType?: string | null;
  vin?: string | null;
  owner?: string | null;
  ownerDisplayName?: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "— No Status —" },
  { value: "in_service", label: "In Service" },
  { value: "ready", label: "Ready" },
  { value: "on_hold", label: "On Hold" },
];

const PERSONAL_STATUS_OPTIONS = [
  { value: "", label: "— No Status —" },
  { value: "ready", label: "Ready" },
  { value: "service_due", label: "Service Due" },
  { value: "needs_attention", label: "Needs Attention" },
  { value: "out_of_service", label: "Out of Service" },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: "car",        label: "Car / Truck" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "boat",       label: "Boat" },
  { value: "atv",        label: "ATV / UTV" },
];

function statusBadge(status?: string | null) {
  switch (status) {
    case "in_service":
      return <span className="bg-blue-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">In Service</span>;
    case "ready":
      return <span className="bg-green-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">Ready</span>;
    case "on_hold":
      return <span className="bg-amber-500 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">On Hold</span>;
    case "service_due":
      return <span className="bg-amber-500 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">Service Due</span>;
    case "needs_attention":
      return <span className="bg-orange-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">Needs Attention</span>;
    case "out_of_service":
      return <span className="bg-red-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide">Out of Service</span>;
    default:
      return null;
  }
}

function statusActiveColor(value: string): string {
  switch (value) {
    case "in_service": return "bg-blue-600 text-white border-blue-600";
    case "ready":      return "bg-green-600 text-white border-green-600";
    case "on_hold":    return "bg-amber-500 text-white border-amber-500";
    case "service_due": return "bg-amber-500 text-white border-amber-500";
    case "needs_attention": return "bg-orange-600 text-white border-orange-600";
    case "out_of_service":  return "bg-red-600 text-white border-red-600";
    default:           return "bg-black text-white border-black";
  }
}

const vehicleTypeLabels: Record<string, string> = {
  car: "Car / Truck",
  motorcycle: "Motorcycle",
  boat: "Boat",
  atv: "ATV / UTV",
};

const emptyForm = {
  stockNumber: "",
  year: String(new Date().getFullYear()),
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

type FormState = typeof emptyForm;
type FormErrors = Partial<Record<keyof FormState, string>>;

type CarItem = {
  id: number;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  color?: string;
  mileage?: number;
  status?: string;
  carType?: string;
  vehicleType?: string;
  vehicleSubtype?: string;
  owner?: string;
  sold?: number;
  createdAt?: string;
  mechanicId?: number | null;
  mechanicName?: string | null;
  isLinkedCar?: boolean;
  linkedMechanicId?: number | null;
};

function getIsAdmin(): boolean {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.isAdmin === true;
  } catch { return false; }
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("dt_mechanic") || "{}") as { displayName?: string; role?: string };
  } catch { return {}; }
}

export default function CarsList() {
  const queryClient = useQueryClient();
  const { data: cars, isLoading, isError } = useListCars();
  const isAdmin = getIsAdmin();
  const { mutate: createCar, isPending: isCreating } = useCreateCar();

  const session = getSession();
  const isDriver = session.role === "driver";
  const isMechanic = !isAdmin && !isDriver;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [carView, setCarView] = useState<"all" | "work" | "personal" | "clients">("all");
  const [showSold, setShowSold] = useState(false);
  const [soldCollapsed, setSoldCollapsed] = useState(true);

  const [vinChecking, setVinChecking] = useState(false);
  const [vinMatch, setVinMatch] = useState<VinMatch | null>(null);
  const [vinImportOpen, setVinImportOpen] = useState(false);
  const [vinImportStockNumber, setVinImportStockNumber] = useState("");
  const [vinImporting, setVinImporting] = useState(false);
  const [vinImportError, setVinImportError] = useState("");

  const [linkVinOpen, setLinkVinOpen] = useState(false);
  const [linkVin, setLinkVin] = useState("");
  const [linkVehicleType, setLinkVehicleType] = useState("");
  const [linkSearching, setLinkSearching] = useState(false);
  const [linkMatch, setLinkMatch] = useState<VinMatch | null>(null);
  const [linkSearchError, setLinkSearchError] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinkCarId, setUnlinkCarId] = useState<number | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  type MechanicOption = { id: number; username: string; displayName: string; role?: string | null };
  const [allMechanics, setAllMechanics] = useState<MechanicOption[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const mechanicId = JSON.parse(localStorage.getItem("dt_mechanic") || "{}").mechanicId || "";
    fetch(`${BASE}/api/admin/mechanics`, { headers: { "X-Mechanic-Id": String(mechanicId) } })
      .then(r => r.json())
      .then((data: MechanicOption[]) => setAllMechanics(data))
      .catch(() => setAllMechanics([]));
  }, [isAdmin]);

  const techOptions = allMechanics.filter(m => m.role !== "driver");
  const clientOptions = allMechanics.filter(m => m.role === "driver");

  // --- Assign Tech dialog ---
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignCarId, setReassignCarId] = useState<number | null>(null);
  const [reassignCarLabel, setReassignCarLabel] = useState("");
  const [selectedMechanicId, setSelectedMechanicId] = useState<number | "none" | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState("");

  const openAssignTechDialog = (e: React.MouseEvent, car: CarItem) => {
    e.preventDefault();
    e.stopPropagation();
    setReassignCarId(car.id);
    setReassignCarLabel(`${car.year} ${car.make} ${car.model}`);
    setSelectedMechanicId(car.mechanicId ?? "none");
    setReassignError("");
    setReassigning(false);
    setReassignOpen(true);
  };

  const handleReassign = async () => {
    if (!reassignCarId || selectedMechanicId === null) return;
    setReassigning(true);
    setReassignError("");
    try {
      const mechanicId = JSON.parse(localStorage.getItem("dt_mechanic") || "{}").mechanicId || "";
      const techId = selectedMechanicId === "none" ? null : selectedMechanicId;
      const res = await fetch(`${BASE}/api/admin/cars/${reassignCarId}/reassign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Mechanic-Id": String(mechanicId) },
        body: JSON.stringify({ mechanicId: techId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setReassignError(err.error || "Reassign failed.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      setReassignOpen(false);
    } catch {
      setReassignError("Could not reach the server.");
    } finally {
      setReassigning(false);
    }
  };

  // --- Assign Client dialog ---
  const [assignClientOpen, setAssignClientOpen] = useState(false);
  const [assignClientCarId, setAssignClientCarId] = useState<number | null>(null);
  const [assignClientCarLabel, setAssignClientCarLabel] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<number | null | "none">(null);
  const [assigningClient, setAssigningClient] = useState(false);
  const [assignClientError, setAssignClientError] = useState("");

  const openAssignClientDialog = (e: React.MouseEvent, car: CarItem) => {
    e.preventDefault();
    e.stopPropagation();
    setAssignClientCarId(car.id);
    setAssignClientCarLabel(`${car.year} ${car.make} ${car.model}`);
    setSelectedDriverId(car.linkedMechanicId ?? "none");
    setAssignClientError("");
    setAssigningClient(false);
    setAssignClientOpen(true);
  };

  const handleAssignClient = async () => {
    if (!assignClientCarId || selectedDriverId === null) return;
    setAssigningClient(true);
    setAssignClientError("");
    try {
      const mechanicId = JSON.parse(localStorage.getItem("dt_mechanic") || "{}").mechanicId || "";
      const driverId = selectedDriverId === "none" ? null : selectedDriverId;
      const res = await fetch(`${BASE}/api/admin/cars/${assignClientCarId}/assign-driver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Mechanic-Id": String(mechanicId) },
        body: JSON.stringify({ driverId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setAssignClientError(err.error || "Failed to assign client.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      setAssignClientOpen(false);
    } catch {
      setAssignClientError("Could not reach the server.");
    } finally {
      setAssigningClient(false);
    }
  };

  const searchLinkVin = async () => {
    const trimmed = linkVin.trim().toUpperCase();
    if (trimmed.length < 11) { setLinkSearchError("Enter at least 11 characters of the VIN."); return; }
    if (!linkVehicleType) { setLinkSearchError("Select a vehicle type first."); return; }
    setLinkSearching(true);
    setLinkMatch(null);
    setLinkSearchError("");
    try {
      const mechanicId = JSON.parse(localStorage.getItem("dt_mechanic") || "{}").mechanicId || "";
      const params = new URLSearchParams({ vin: trimmed, vehicleType: linkVehicleType });
      const res = await fetch(`${BASE}/api/vin-lookup?${params}`, {
        headers: { "X-Mechanic-Id": String(mechanicId) },
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { found: boolean; car?: VinMatch };
      if (data.found && data.car) {
        setLinkMatch(data.car);
      } else {
        const typeLabel = linkVehicleType === "motorcycle" ? "motorcycle" : linkVehicleType === "boat" ? "boat" : linkVehicleType === "atv" ? "ATV/off-road vehicle" : "car/truck";
        setLinkSearchError(`No ${typeLabel} found with that VIN, or you are already linked to it.`);
      }
    } catch {
      setLinkSearchError("Could not reach the server.");
    } finally {
      setLinkSearching(false);
    }
  };

  const handleLink = async () => {
    if (!linkMatch) return;
    setLinking(true);
    setLinkSearchError("");
    try {
      const mechanicId = JSON.parse(localStorage.getItem("dt_mechanic") || "{}").mechanicId || "";
      const res = await fetch(`${BASE}/api/cars/${linkMatch.id}/link`, {
        method: "POST",
        headers: { "X-Mechanic-Id": String(mechanicId) },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setLinkSearchError(err.error || "Could not link vehicle.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      setLinkVinOpen(false);
      setLinkVin("");
      setLinkMatch(null);
    } catch {
      setLinkSearchError("Could not reach the server.");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (carId: number) => {
    setUnlinkCarId(carId);
    setUnlinking(true);
    try {
      const mechanicId = JSON.parse(localStorage.getItem("dt_mechanic") || "{}").mechanicId || "";
      await fetch(`${BASE}/api/cars/${carId}/link`, {
        method: "DELETE",
        headers: { "X-Mechanic-Id": String(mechanicId) },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
    } catch {
      // silent
    } finally {
      setUnlinking(false);
      setUnlinkCarId(null);
    }
  };

  const checkVin = async (vin: string) => {
    const trimmed = vin.trim().toUpperCase();
    if (trimmed.length < 11) return;
    setVinChecking(true);
    try {
      const res = await fetch(`${BASE}/api/vin-lookup?vin=${encodeURIComponent(trimmed)}`);
      if (!res.ok) return;
      const data = await res.json() as { found: boolean; car?: VinMatch };
      if (data.found && data.car) {
        setVinMatch(data.car);
        setVinImportStockNumber(form.stockNumber);
        setVinImportOpen(true);
      }
    } catch {
      // silent
    } finally {
      setVinChecking(false);
    }
  };

  const handleImport = async () => {
    if (!vinMatch) return;
    if (!vinImportStockNumber.trim()) {
      setVinImportError("Enter a stock / ID number.");
      return;
    }
    setVinImportError("");
    setVinImporting(true);
    try {
      const res = await fetch(`${BASE}/api/cars/${vinMatch.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Mechanic-Id": String(JSON.parse(localStorage.getItem("dt_mechanic") || "{}").mechanicId || "") },
        body: JSON.stringify({ stockNumber: vinImportStockNumber.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setVinImportError(err.error || "Import failed.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      setVinImportOpen(false);
      setDialogOpen(false);
      setVinMatch(null);
    } catch {
      setVinImportError("Could not reach the server.");
    } finally {
      setVinImporting(false);
    }
  };

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const setVehicleType = (vt: string) => {
    setForm(f => ({
      ...f,
      vehicleType: vt as FormState["vehicleType"],
      vehicleSubtype: getDefaultSubtype(vt),
    }));
  };

  const openAddDialog = () => {
    setForm({
      ...emptyForm,
      ...(isDriver ? { carType: "personal" as const, owner: session.displayName || "" } : {}),
    });
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const validate = () => {
    const newErrors: FormErrors = {};
    if (form.carType !== "personal" && !form.stockNumber.trim()) newErrors.stockNumber = "Required";
    if (!form.year.trim() || isNaN(Number(form.year))) newErrors.year = "Required";
    if (!form.make.trim()) newErrors.make = "Required";
    if (!form.model.trim()) newErrors.model = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    setSubmitError("");
    if (!validate()) return;
    const yr = Number(form.year);
    const mi = form.mileage ? Number(form.mileage) : undefined;
    const stockNumber = form.carType === "personal" && !form.stockNumber.trim()
      ? `PERSONAL-${Date.now()}`
      : form.stockNumber.trim();
    createCar({
      data: {
        stockNumber,
        year: yr,
        make: form.make.trim(),
        model: form.model.trim(),
        vin: form.vin.trim() || undefined,
        color: form.color.trim() || undefined,
        mileage: mi,
        status: (form.status || undefined) as CreateCarStatus | undefined,
        carType: form.carType as CreateCarCarType,
        vehicleType: form.vehicleType as CreateCarVehicleType,
        vehicleSubtype: form.vehicleSubtype as CreateCarVehicleSubtype,
        owner: form.carType === "personal" && form.owner.trim() ? form.owner.trim() : undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
        setDialogOpen(false);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to save. Please try again.";
        setSubmitError(msg);
      },
    });
  };

  const allCars = ((cars as unknown) as CarItem[] | undefined) ?? [];
  const activeCars = allCars.filter(c => !c.sold);
  const soldCars = allCars.filter(c => c.sold);

  const filterCars = (list: CarItem[]) => {
    let result = list;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(c =>
        `${c.year} ${c.make} ${c.model} ${c.stockNumber} ${c.vin || ""} ${c.owner || ""}`.toLowerCase().includes(q)
      );
    }

    const typeFilters = ["car", "motorcycle", "boat", "atv"].filter(t => activeFilters.has(`type:${t}`));
    if (typeFilters.length > 0) {
      result = result.filter(c => typeFilters.includes(c.vehicleType || "car"));
    }

    const statusFilters = ["in_service", "ready", "on_hold", "service_due", "needs_attention", "out_of_service"].filter(s => activeFilters.has(`status:${s}`));
    if (statusFilters.length > 0) {
      result = result.filter(c => statusFilters.includes(c.status || ""));
    }

    if (carView === "work") result = result.filter(c => (c.carType === "dealer" || !c.carType) && !c.isLinkedCar);
    else if (carView === "personal") result = result.filter(c => c.carType === "personal" && !c.isLinkedCar);
    else if (carView === "clients") result = result.filter(c => c.isLinkedCar === true);

    return result;
  };

  const filteredActive = filterCars(activeCars);
  const filteredSold = filterCars(soldCars);

  const vLabel = vinLabel(undefined);
  const mLabel = mileageLabel(undefined);

  const subtypeOptions = getSubtypesForVehicleType(form.vehicleType);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-4xl sm:text-5xl font-black uppercase">Vehicles</h1>
        {!isAdmin && (
          <div className="flex gap-3 flex-wrap">
            {isMechanic && (
              <Button
                type="button"
                variant="outline"
                onClick={() => { setLinkVin(""); setLinkMatch(null); setLinkSearchError(""); setLinkVinOpen(true); }}
                size="lg"
                className="font-black uppercase text-xl px-6 py-3 border-4 border-black"
              >
                <Link2 className="w-6 h-6 mr-2" /> Link by VIN
              </Button>
            )}
            <Button onClick={openAddDialog} size="lg" className="font-black uppercase text-xl px-6 py-3">
              <Plus className="w-6 h-6 mr-2" /> Add
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-amber-100 border-4 border-amber-600 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
          <span className="bg-amber-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-widest">Admin</span>
          <span className="font-black text-amber-900 text-lg">Viewing all mechanics' vehicles</span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, stock #, VIN, or owner..."
            className="pl-10 bg-white text-black"
          />
        </div>
      </div>

      {/* Work / Personal / Clients slider — hidden for driver/operator accounts */}
      {!isDriver && (
        <div className="flex border-4 border-black rounded-xl overflow-hidden mb-4">
          {([
            { key: "all",      label: "All" },
            { key: "work",     label: "Work" },
            { key: "personal", label: "Personal" },
            { key: "clients",  label: "Clients" },
          ] as const).map(({ key, label }, i, arr) => (
            <button
              key={key}
              type="button"
              onClick={() => setCarView(key)}
              className={`flex-1 py-3 font-black uppercase text-base tracking-wide transition-colors tap-target ${
                i < arr.length - 1 ? "border-r-2 border-black" : ""
              } ${carView === key ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Filter badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: "type:car",        label: "Car / Truck",  on: "bg-slate-700 text-white",  off: "bg-white text-black border-2 border-slate-400" },
          { key: "type:motorcycle", label: "Motorcycle",   on: "bg-slate-700 text-white",  off: "bg-white text-black border-2 border-slate-400" },
          { key: "type:boat",       label: "Boat",         on: "bg-slate-700 text-white",  off: "bg-white text-black border-2 border-slate-400" },
          { key: "type:atv",        label: "ATV / UTV",    on: "bg-slate-700 text-white",  off: "bg-white text-black border-2 border-slate-400" },
          { key: "status:in_service",      label: "In Service",      on: "bg-blue-600 text-white",   off: "bg-white text-black border-2 border-blue-400",   techOnly: true },
          { key: "status:ready",           label: "Ready",           on: "bg-green-600 text-white",  off: "bg-white text-black border-2 border-green-400",  techOnly: true },
          { key: "status:on_hold",         label: "On Hold",         on: "bg-amber-500 text-white",  off: "bg-white text-black border-2 border-amber-400",  techOnly: true },
          { key: "status:service_due",     label: "Service Due",     on: "bg-amber-500 text-white",  off: "bg-white text-black border-2 border-amber-400",  techOnly: false },
          { key: "status:needs_attention", label: "Needs Attention", on: "bg-orange-600 text-white", off: "bg-white text-black border-2 border-orange-400", techOnly: false },
          { key: "status:out_of_service",  label: "Out of Service",  on: "bg-red-600 text-white",    off: "bg-white text-black border-2 border-red-400",    techOnly: false },
        ].filter(f => !isDriver || !f.techOnly).map(({ key, label, on, off }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleFilter(key)}
            className={`px-3 py-1.5 rounded-lg font-black uppercase text-sm tracking-wide transition-colors ${activeFilters.has(key) ? on : off}`}
          >
            {label}
          </button>
        ))}
        {activeFilters.size > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilters(new Set())}
            className="px-3 py-1.5 rounded-lg font-black uppercase text-sm tracking-wide bg-white text-black border-2 border-gray-300 text-gray-500"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && <p className="text-xl font-bold text-center py-12 text-muted-foreground">Loading vehicles...</p>}
      {isError && <p className="text-xl font-bold text-center py-12 text-destructive">Failed to load vehicles.</p>}

      {!isLoading && !isError && filteredActive.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <p className="text-2xl font-bold text-muted-foreground uppercase">No vehicles yet</p>
          <p className="text-lg text-muted-foreground">Tap "Add" to add your first vehicle.</p>
        </div>
      )}

      <div className="space-y-4">
        {filteredActive.map(car => {
          const vt = car.vehicleType || "car";
          return (
          <Link key={car.id} href={`/cars/${car.id}`} className="block">
            <div className="bg-card border-4 border-black rounded-2xl p-5 active:bg-muted transition-colors">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    {car.carType !== "personal" && (
                      <span className="bg-secondary text-secondary-foreground font-black px-3 py-1 rounded text-lg tracking-wider">
                        #{car.stockNumber}
                      </span>
                    )}
                    {car.carType === "personal" && (
                      <span className="bg-teal-700 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">Personal</span>
                    )}
                    {car.isLinkedCar && (
                      <span className="bg-indigo-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> Client
                      </span>
                    )}
                    {vt !== "car" || car.vehicleSubtype ? (
                      <span className="bg-slate-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                        {vehicleSubtypeLabel(vt, car.vehicleSubtype) || (vehicleTypeLabels[vt] ?? vt)}
                      </span>
                    ) : null}
                    {isAdmin && (
                      <>
                        {car.mechanicName && (
                          <span className="bg-amber-500 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                            <Wrench className="w-3 h-3 inline mr-1" />{car.mechanicName}
                          </span>
                        )}
                        {car.linkedMechanicId && (() => {
                          const client = allMechanics.find(m => m.id === car.linkedMechanicId);
                          return client ? (
                            <span className="bg-teal-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                              <UserCircle className="w-3 h-3 inline mr-1" />{client.displayName}
                            </span>
                          ) : null;
                        })()}
                        <button
                          type="button"
                          onClick={e => openAssignTechDialog(e, car)}
                          className="flex items-center gap-1 bg-white text-black font-black px-2 py-1 rounded text-xs uppercase tracking-wide border-2 border-black"
                        >
                          <Wrench className="w-3 h-3" /> Tech
                        </button>
                        <button
                          type="button"
                          onClick={e => openAssignClientDialog(e, car)}
                          className="flex items-center gap-1 bg-white text-black font-black px-2 py-1 rounded text-xs uppercase tracking-wide border-2 border-black"
                        >
                          <UserCircle className="w-3 h-3" /> Client
                        </button>
                      </>
                    )}
                    {car.isLinkedCar && isMechanic && (
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); handleUnlink(car.id); }}
                        disabled={unlinking && unlinkCarId === car.id}
                        className="flex items-center gap-1 bg-white text-red-700 font-black px-2 py-1 rounded text-xs uppercase tracking-wide border-2 border-red-400"
                      >
                        <Unlink className="w-3 h-3" /> {unlinking && unlinkCarId === car.id ? "…" : "Unlink"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {car.sold
                      ? <span className="bg-gray-500 text-white font-black px-3 py-1 rounded text-sm uppercase">Sold</span>
                      : !isDriver ? statusBadge(car.status) : null
                    }
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase leading-tight">
                    {car.year} {car.make} {car.model}
                  </h2>
                  {car.carType === "personal" && car.owner && (
                    <p className="text-lg font-bold text-teal-700 uppercase">{car.owner}</p>
                  )}
                </div>

                <div className="text-right font-mono text-lg font-bold text-muted-foreground space-y-1">
                  {car.mileage != null && <div>{car.mileage.toLocaleString()} {mileageLabel(vt).unit}</div>}
                  {car.color && <div className="uppercase">{car.color}</div>}
                </div>
              </div>
            </div>
          </Link>
        )})}
      </div>

      {soldCars.length > 0 && (
        <div className="mt-12">
          <button
            type="button"
            onClick={() => { setShowSold(!showSold); setSoldCollapsed(!soldCollapsed); }}
            className="flex items-center gap-3 text-2xl font-black uppercase text-muted-foreground mb-4 bg-transparent border-0 p-0"
          >
            {showSold ? <EyeOff className="w-7 h-7" /> : <Eye className="w-7 h-7" />}
            Sold Vehicles ({soldCars.length})
            {showSold ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
          </button>

          {showSold && (
            <div className="space-y-4 opacity-60">
              {filteredSold.map(car => {
                const vt = car.vehicleType || "car";
                return (
                <Link key={car.id} href={`/cars/${car.id}`} className="block">
                  <div className="bg-card border-4 border-gray-400 rounded-2xl p-5 active:bg-muted transition-colors">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          {car.carType !== "personal" && (
                            <span className="bg-secondary text-secondary-foreground font-black px-3 py-1 rounded text-lg tracking-wider">
                              #{car.stockNumber}
                            </span>
                          )}
                          <span className="bg-gray-500 text-white font-black px-3 py-1 rounded text-sm uppercase">Sold</span>
                          {car.carType === "personal" && (
                            <span className="bg-teal-700 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">Personal</span>
                          )}
                          {vt !== "car" || car.vehicleSubtype ? (
                            <span className="bg-slate-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                              {vehicleSubtypeLabel(vt, car.vehicleSubtype) || (vehicleTypeLabels[vt] ?? vt)}
                            </span>
                          ) : null}
                          {isAdmin && (
                            <>
                              {car.mechanicName && (
                                <span className="bg-amber-500 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                                  <Wrench className="w-3 h-3 inline mr-1" />{car.mechanicName}
                                </span>
                              )}
                              {car.linkedMechanicId && (() => {
                                const client = allMechanics.find(m => m.id === car.linkedMechanicId);
                                return client ? (
                                  <span className="bg-teal-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                                    <UserCircle className="w-3 h-3 inline mr-1" />{client.displayName}
                                  </span>
                                ) : null;
                              })()}
                              <button
                                type="button"
                                onClick={e => openAssignTechDialog(e, car)}
                                className="flex items-center gap-1 bg-white text-black font-black px-2 py-1 rounded text-xs uppercase tracking-wide border-2 border-black"
                              >
                                <Wrench className="w-3 h-3" /> Tech
                              </button>
                              <button
                                type="button"
                                onClick={e => openAssignClientDialog(e, car)}
                                className="flex items-center gap-1 bg-white text-black font-black px-2 py-1 rounded text-xs uppercase tracking-wide border-2 border-black"
                              >
                                <UserCircle className="w-3 h-3" /> Client
                              </button>
                            </>
                          )}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black uppercase leading-tight">
                          {car.year} {car.make} {car.model}
                        </h2>
                        {car.carType === "personal" && car.owner && (
                          <p className="text-lg font-bold text-teal-700 uppercase">{car.owner}</p>
                        )}
                      </div>
                      <div className="text-right font-mono text-lg font-bold text-muted-foreground space-y-1">
                        {car.mileage != null && <div>{car.mileage.toLocaleString()} {mileageLabel(vt).unit}</div>}
                        {car.color && <div className="uppercase">{car.color}</div>}
                      </div>
                    </div>
                  </div>
                </Link>
              )})}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black uppercase">Add Vehicle</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {form.carType !== "personal" && (
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Stock / ID *</label>
                <Input
                  value={form.stockNumber}
                  onChange={e => setField("stockNumber", e.target.value)}
                  placeholder="e.g. A1234"
                  className="bg-white text-black"
                />
                {errors.stockNumber && <p className="text-destructive font-bold text-sm">{errors.stockNumber}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Year *</label>
                <Input
                  value={form.year}
                  onChange={e => setField("year", e.target.value)}
                  inputMode="numeric"
                  className="bg-white text-black"
                />
                {errors.year && <p className="text-destructive font-bold text-sm">{errors.year}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Color</label>
                <Input
                  value={form.color}
                  onChange={e => setField("color", e.target.value)}
                  placeholder="e.g. Red"
                  className="bg-white text-black"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Make *</label>
              <Input
                value={form.make}
                onChange={e => setField("make", e.target.value)}
                placeholder="e.g. Toyota"
                className="bg-white text-black"
              />
              {errors.make && <p className="text-destructive font-bold text-sm">{errors.make}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Model *</label>
              <Input
                value={form.model}
                onChange={e => setField("model", e.target.value)}
                placeholder="e.g. Camry"
                className="bg-white text-black"
              />
              {errors.model && <p className="text-destructive font-bold text-sm">{errors.model}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">{vinLabel(form.vehicleType).label}</label>
              <Input
                value={form.vin}
                onChange={e => setField("vin", e.target.value)}
                onBlur={e => checkVin(e.target.value)}
                placeholder={vinLabel(form.vehicleType).placeholder}
                className="bg-white text-black"
              />
              {vinChecking && <p className="text-sm font-bold text-gray-500">Checking VIN across accounts...</p>}
            </div>

            <div className="space-y-1">
              <label className="text-base font-black uppercase block">{mileageLabel(form.vehicleType).fieldLabel}</label>
              <Input
                value={form.mileage}
                onChange={e => setField("mileage", e.target.value)}
                inputMode="numeric"
                placeholder={mileageLabel(form.vehicleType).placeholder}
                className="bg-white text-black"
              />
            </div>

            {!isDriver && (
              <div className="space-y-2">
                <label className="text-base font-black uppercase block">Ownership</label>
                <div className="flex gap-3">
                  {[{ value: "dealer", label: "Work" }, { value: "personal", label: "Personal" }].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField("carType", opt.value)}
                      className={`flex-1 px-4 py-3 rounded-xl border-4 font-black uppercase text-sm transition-colors ${
                        form.carType === opt.value
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-black"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Vehicle Type</label>
              <div className="grid grid-cols-2 gap-3">
                {VEHICLE_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVehicleType(opt.value)}
                    className={`px-4 py-3 rounded-xl border-4 font-black uppercase text-sm transition-colors ${
                      form.vehicleType === opt.value
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
              <label className="text-base font-black uppercase block">
                {form.vehicleType === "car" ? "Body Style" : form.vehicleType === "motorcycle" ? "Motorcycle Type" : form.vehicleType === "boat" ? "Boat Type" : "ATV / UTV Type"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {subtypeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField("vehicleSubtype", opt.value)}
                    className={`px-4 py-3 rounded-xl border-4 font-black uppercase text-sm transition-colors ${
                      form.vehicleSubtype === opt.value
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-black"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.carType === "personal" && (
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Owner Name</label>
                <Input
                  value={form.owner}
                  onChange={e => setField("owner", e.target.value)}
                  placeholder="e.g. John Smith"
                  className="bg-white text-black"
                />
                {isDriver && (
                  <p className="text-xs text-gray-500 font-medium">
                    Auto-filled from your account — change it if this vehicle belongs to someone else.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Status</label>
              <div className="flex flex-wrap gap-3">
                {(form.carType === "personal" ? PERSONAL_STATUS_OPTIONS : STATUS_OPTIONS).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField("status", opt.value)}
                    className={`px-4 py-2 rounded-lg border-4 font-black uppercase text-sm transition-colors ${
                      form.status === opt.value
                        ? statusActiveColor(opt.value)
                        : "bg-white text-black border-black"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {submitError && <p className="text-destructive font-bold text-lg">{submitError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
              <Button type="button" size="lg" disabled={isCreating} onClick={handleSubmit}>
                {isCreating ? "SAVING..." : "ADD VEHICLE"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIN Import Dialog */}
      <Dialog open={vinImportOpen} onOpenChange={open => { if (!open) { setVinImportOpen(false); setVinMatch(null); setVinImportError(""); } }}>
        <DialogContent className="max-w-md bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
              <Download className="w-6 h-6" /> Vehicle Found
            </DialogTitle>
          </DialogHeader>
          {vinMatch && (
            <div className="space-y-5 py-2">
              <div className="bg-gray-100 border-2 border-black rounded-xl p-4 space-y-1">
                <p className="text-2xl font-black uppercase">{vinMatch.year} {vinMatch.make} {vinMatch.model}</p>
                {vinMatch.color && <p className="font-bold text-gray-600 uppercase">{vinMatch.color}</p>}
                {vinMatch.mileage != null && (
                  <p className="font-bold text-gray-600">{vinMatch.mileage.toLocaleString()} {mileageLabel(vinMatch.vehicleType ?? undefined).unit}</p>
                )}
                {vinMatch.vin && <p className="font-mono text-sm text-gray-500">{vinMatch.vin}</p>}
              </div>
              <p className="font-bold text-gray-700">
                Another mechanic already has this vehicle on file. Would you like to import all its data — including inspections, maintenance history, mileage log, and todos — into your account?
              </p>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Your Stock / ID # *</label>
                <Input
                  value={vinImportStockNumber}
                  onChange={e => { setVinImportStockNumber(e.target.value); setVinImportError(""); }}
                  placeholder="e.g. A1234"
                  className="bg-white text-black"
                />
              </div>
              {vinImportError && <p className="text-destructive font-bold">{vinImportError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" onClick={() => { setVinImportOpen(false); setVinMatch(null); }}>
                  NO THANKS
                </Button>
                <Button type="button" size="lg" disabled={vinImporting} onClick={handleImport}>
                  {vinImporting ? "IMPORTING..." : "IMPORT VEHICLE"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Technician dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
              <Wrench className="w-6 h-6" /> Assign Technician
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="font-bold text-gray-700 text-lg">{reassignCarLabel}</p>
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Technician</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedMechanicId("none")}
                  className={`w-full px-4 py-3 rounded-xl border-4 font-black uppercase text-left transition-colors ${
                    selectedMechanicId === "none"
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-black"
                  }`}
                >
                  — None / Unassigned —
                </button>
                {techOptions.length === 0 ? (
                  <p className="text-gray-500 font-bold">No technician accounts found.</p>
                ) : (
                  techOptions.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMechanicId(m.id)}
                      className={`w-full px-4 py-3 rounded-xl border-4 font-black uppercase text-left transition-colors ${
                        selectedMechanicId === m.id
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-black"
                      }`}
                    >
                      {m.displayName}
                      <span className="ml-2 font-mono text-sm opacity-60">@{m.username}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            {reassignError && <p className="text-red-600 font-bold">{reassignError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setReassignOpen(false)}>CANCEL</Button>
            <Button type="button" size="lg" disabled={selectedMechanicId === null || reassigning} onClick={handleReassign}>
              {reassigning ? "SAVING..." : "ASSIGN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Client dialog */}
      <Dialog open={assignClientOpen} onOpenChange={setAssignClientOpen}>
        <DialogContent className="bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
              <UserCircle className="w-6 h-6" /> Assign Client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="font-bold text-gray-700 text-lg">{assignClientCarLabel}</p>
            <div className="space-y-1">
              <label className="text-base font-black uppercase block">Client / Driver</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedDriverId("none")}
                  className={`w-full px-4 py-3 rounded-xl border-4 font-black uppercase text-left transition-colors ${
                    selectedDriverId === "none"
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-black"
                  }`}
                >
                  — None / Clear —
                </button>
                {clientOptions.length === 0 ? (
                  <p className="text-gray-500 font-bold">No driver accounts found.</p>
                ) : (
                  clientOptions.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedDriverId(m.id)}
                      className={`w-full px-4 py-3 rounded-xl border-4 font-black uppercase text-left transition-colors ${
                        selectedDriverId === m.id
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-black"
                      }`}
                    >
                      {m.displayName}
                      <span className="ml-2 font-mono text-sm opacity-60">@{m.username}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            {assignClientError && <p className="text-red-600 font-bold">{assignClientError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setAssignClientOpen(false)}>CANCEL</Button>
            <Button type="button" size="lg" disabled={selectedDriverId === null || assigningClient} onClick={handleAssignClient}>
              {assigningClient ? "SAVING..." : "ASSIGN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Link by VIN dialog */}
      <Dialog open={linkVinOpen} onOpenChange={open => { setLinkVinOpen(open); if (!open) { setLinkMatch(null); setLinkSearchError(""); setLinkVehicleType(""); setLinkVin(""); } }}>
        <DialogContent className="bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
              <Link2 className="w-6 h-6" /> Link Client Vehicle by VIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="text-gray-600 font-bold">Enter the VIN of a vehicle already registered by a client. It will appear in your list so you can track service history, inspections, and maintenance for them.</p>

            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Vehicle Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "car",        label: "Car / Truck" },
                  { value: "motorcycle", label: "Motorcycle" },
                  { value: "boat",       label: "Boat" },
                  { value: "atv",        label: "ATV / Off-Road" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setLinkVehicleType(value); setLinkMatch(null); setLinkSearchError(""); }}
                    className={`py-3 px-4 border-2 rounded-lg font-black uppercase text-base ${
                      linkVehicleType === value
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-gray-300 hover:border-black"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-base font-black uppercase block">VIN</label>
              <div className="flex gap-2">
                <Input
                  value={linkVin}
                  onChange={e => { setLinkVin(e.target.value.toUpperCase()); setLinkMatch(null); setLinkSearchError(""); }}
                  placeholder="Enter VIN (min. 11 characters)"
                  className="bg-white text-black font-mono flex-1"
                  maxLength={17}
                />
                <Button
                  type="button"
                  onClick={searchLinkVin}
                  disabled={linkSearching || linkVin.trim().length < 11 || !linkVehicleType}
                  className="font-black uppercase"
                >
                  {linkSearching ? "..." : "Search"}
                </Button>
              </div>
              {!linkVehicleType && linkVin.trim().length >= 11 && (
                <p className="text-amber-600 font-bold text-sm">Select a vehicle type above to search.</p>
              )}
              {linkSearchError && <p className="text-red-600 font-bold text-sm">{linkSearchError}</p>}
            </div>

            {linkMatch && (
              <div className="bg-green-50 border-4 border-green-600 rounded-xl p-4 space-y-2">
                <p className="font-black text-green-800 text-lg uppercase">Vehicle Found</p>
                <p className="font-black text-2xl">{linkMatch.year} {linkMatch.make} {linkMatch.model}</p>
                {(linkMatch.owner || linkMatch.ownerDisplayName) && (
                  <p className="font-bold text-gray-700">Owner: {linkMatch.owner || linkMatch.ownerDisplayName}</p>
                )}
                {linkMatch.color && <p className="font-bold text-gray-600">{linkMatch.color}</p>}
                {linkMatch.mileage && <p className="font-bold text-gray-600">{linkMatch.mileage.toLocaleString()} miles</p>}
                <p className="font-mono text-sm text-gray-500">{linkMatch.vin}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setLinkVinOpen(false)}>CANCEL</Button>
            <Button
              type="button"
              size="lg"
              disabled={!linkMatch || linking}
              onClick={handleLink}
            >
              {linking ? "LINKING..." : "ADD TO MY LIST"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
