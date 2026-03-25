import { useState } from "react";
import { Link } from "wouter";
import { useListCars, useCreateCar, CreateCarStatus, CreateCarCarType, CreateCarVehicleType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Car, Plus, Key, Gauge, Search, User } from "lucide-react";

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

function vinLabel(vehicleType?: string | null): { label: string; placeholder: string; empty: string } {
  switch (vehicleType) {
    case "boat":       return { label: "Hull ID (HIN)", placeholder: "e.g. ABC12345D101", empty: "NO HIN RECORDED" };
    case "atv":        return { label: "VIN / Serial #", placeholder: "Serial # (may be shorter than 17 digits)", empty: "NO VIN/SERIAL RECORDED" };
    case "motorcycle": return { label: "VIN", placeholder: "VIN (vintage bikes may be shorter)", empty: "NO VIN RECORDED" };
    default:           return { label: "VIN", placeholder: "17-character VIN", empty: "NO VIN RECORDED" };
  }
}

type TabType = "all" | "dealer" | "personal";
const TABS: { value: TabType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dealer", label: "Dealership" },
  { value: "personal", label: "Personal" },
];

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
  owner?: string;
  sold: number;
};

function CarCard({ car }: { car: CarItem }) {
  return (
    <Link href={`/cars/${car.id}`} className="group outline-none">
      <div className={`h-full border-4 border-black bg-white rounded-2xl p-6 shadow-brutal ${car.sold ? "opacity-60" : ""}`}>
        <div className="flex justify-between items-start mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-black text-white font-mono font-bold px-3 py-1 rounded text-lg">
              #{car.stockNumber}
            </div>
            {car.carType === "personal" && (
              <span className="bg-teal-700 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">Personal</span>
            )}
            {car.vehicleType && car.vehicleType !== "car" && (
              <span className="bg-slate-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                {{ motorcycle: "Motorcycle", boat: "Boat", atv: "ATV/UTV" }[car.vehicleType] ?? car.vehicleType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {car.sold
              ? <span className="bg-gray-500 text-white font-black px-3 py-1 rounded text-sm uppercase">Sold</span>
              : statusBadge(car.status)
            }
            {car.color && <div className="text-gray-600 font-bold">{car.color}</div>}
          </div>
        </div>
        <h2 className="text-3xl font-black uppercase leading-tight mb-6">
          {car.year} {car.make} <br />
          <span className="text-gray-500">{car.model}</span>
        </h2>
        <div className="space-y-3 font-mono font-bold bg-gray-100 p-4 rounded-xl border-2 border-black">
          {car.carType === "personal" && car.owner && (
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-teal-600" />
              <span className="truncate">{car.owner}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-gray-500" />
            <span className="truncate">{car.vin || vinLabel(car.vehicleType).empty}</span>
          </div>
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-gray-500" />
            <span>{car.mileage ? `${car.mileage.toLocaleString()} mi` : 'UNKNOWN MILEAGE'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function matchesSearch(car: CarItem, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    car.stockNumber.toLowerCase().includes(lower) ||
    car.make.toLowerCase().includes(lower) ||
    car.model.toLowerCase().includes(lower) ||
    String(car.year).includes(lower) ||
    (car.vin?.toLowerCase().includes(lower) ?? false) ||
    (car.color?.toLowerCase().includes(lower) ?? false) ||
    (car.owner?.toLowerCase().includes(lower) ?? false)
  );
}

export default function CarsList() {
  const queryClient = useQueryClient();
  const { data: cars, isLoading, isError } = useListCars();
  const { mutate: createCar, isPending } = useCreateCar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [tab, setTab] = useState<TabType>("all");
  const [search, setSearch] = useState("");

  const allActive = cars?.filter(c => !c.sold) ?? [];
  const allSold = cars?.filter(c => c.sold) ?? [];

  const activeFiltered = allActive
    .filter(c => tab === "all" || c.carType === tab)
    .filter(c => matchesSearch(c, search));
  const soldFiltered = allSold
    .filter(c => tab === "all" || c.carType === tab)
    .filter(c => matchesSearch(c, search));

  const totalInTab = allActive.filter(c => tab === "all" || c.carType === tab).length
    + allSold.filter(c => tab === "all" || c.carType === tab).length;

  const openAddDialog = () => {
    setForm({ ...emptyForm, carType: tab === "personal" ? "personal" : "dealer" });
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.stockNumber.trim()) newErrors.stockNumber = "Stock number is required";
    if (!form.make.trim()) newErrors.make = "Make is required";
    if (!form.model.trim()) newErrors.model = "Model is required";
    const yr = Number(form.year);
    if (!form.year || isNaN(yr) || yr < 1900 || yr > 2100) newErrors.year = "Enter a valid year (e.g. 2022)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    setSubmitError("");
    if (!validate()) return;
    const yr = Number(form.year);
    const mi = form.mileage ? Number(form.mileage) : undefined;
    createCar({
      data: {
        stockNumber: form.stockNumber.trim(),
        year: yr,
        make: form.make.trim(),
        model: form.model.trim(),
        vin: form.vin.trim() || undefined,
        color: form.color.trim() || undefined,
        mileage: mi,
        status: (form.status || undefined) as CreateCarStatus | undefined,
        carType: form.carType as CreateCarCarType,
        vehicleType: form.vehicleType as CreateCarVehicleType,
        owner: form.carType === "personal" && form.owner.trim() ? form.owner.trim() : undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
        setDialogOpen(false);
      },
      onError: () => setSubmitError("Failed to save. Please try again."),
    });
  };

  const tabCounts = {
    all: allActive.length,
    dealer: allActive.filter(c => c.carType === "dealer").length,
    personal: allActive.filter(c => c.carType === "personal").length,
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight">Vehicles</h1>
          <p className="text-xl text-muted-foreground mt-2 font-medium">Select a vehicle to log work or inspect.</p>
        </div>
        <Button size="lg" onClick={openAddDialog} className="w-full sm:w-auto text-xl py-8">
          <Plus className="w-8 h-8 mr-2" />
          ADD VEHICLE
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-5 py-3 rounded-xl border-4 font-black uppercase text-base transition-colors ${
              tab === t.value
                ? t.value === "personal"
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-black text-white border-black"
                : "bg-white text-black border-black"
            }`}
          >
            {t.label}
            <span className={`ml-2 text-sm font-bold ${tab === t.value ? "opacity-70" : "text-gray-500"}`}>
              ({tabCounts[t.value]})
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      {totalInTab > 0 && (
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 pointer-events-none" />
          <Input
            className="pl-14 py-6 text-xl font-bold bg-white text-black border-4 border-black rounded-xl"
            placeholder="Search by stock #, make, model, VIN, year, color…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {isLoading && <div className="text-center py-20 text-2xl font-bold">Loading vehicles...</div>}
      {isError && <div className="text-center py-20 text-2xl font-bold text-red-600">Failed to load vehicles.</div>}

      {!isLoading && !isError && totalInTab === 0 && (
        <div className="text-center py-20 border-4 border-dashed border-black rounded-3xl bg-gray-100">
          <Car className="w-24 h-24 mx-auto mb-6 opacity-50" />
          <h2 className="text-3xl font-black uppercase mb-4">
            {tab === "personal" ? "No Personal Vehicles" : tab === "dealer" ? "No Dealership Vehicles" : "Shop is Empty"}
          </h2>
          <p className="text-xl text-gray-600 mb-8">Add a vehicle to start tracking inspections and maintenance.</p>
          <Button size="lg" onClick={openAddDialog}>ADD FIRST VEHICLE</Button>
        </div>
      )}

      {!isLoading && !isError && activeFiltered.length === 0 && soldFiltered.length === 0 && totalInTab > 0 && (
        <div className="text-center py-16 border-4 border-dashed border-black rounded-3xl bg-gray-100 mb-8">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <h2 className="text-2xl font-black uppercase mb-2">No Matches</h2>
          <p className="text-lg text-gray-600">Try a different search term.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeFiltered.map(car => <CarCard key={car.id} car={car} />)}
      </div>

      {soldFiltered.length > 0 && (
        <details className="mt-12 border-4 border-gray-400 rounded-xl overflow-hidden">
          <summary className="flex items-center justify-between gap-4 p-5 bg-gray-100 cursor-pointer font-black uppercase text-xl list-none">
            <span>Sold Vehicles ({soldFiltered.length})</span>
          </summary>
          <div className="p-6 bg-gray-50 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 border-t-4 border-gray-400">
            {soldFiltered.map(car => <CarCard key={car.id} car={car} />)}
          </div>
        </details>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">Add New Vehicle</DialogTitle>
          </DialogHeader>

          {submitError && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-4 rounded-lg">
              {submitError}
            </div>
          )}

          <div className="space-y-5 mt-2">

            {/* Type selector */}
            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Type</label>
              <div className="flex gap-3">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField("carType", opt.value as "dealer" | "personal")}
                    className={`flex-1 px-4 py-3 rounded-xl border-4 font-black uppercase text-base transition-colors ${
                      form.carType === opt.value
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

            {/* Vehicle type selector */}
            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Vehicle Type</label>
              <div className="grid grid-cols-2 gap-3">
                {VEHICLE_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField("vehicleType", opt.value as typeof form.vehicleType)}
                    className={`px-4 py-3 rounded-xl border-4 font-black uppercase text-base transition-colors ${
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

            {form.carType === "personal" && (
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Owner Name</label>
                <Input
                  value={form.owner}
                  onChange={e => setField("owner", e.target.value)}
                  placeholder="e.g. John Smith"
                  className="bg-white text-black"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Stock Number *</label>
                <Input value={form.stockNumber} onChange={e => setField("stockNumber", e.target.value)} placeholder="e.g. 1045A" className="bg-white text-black" />
                {errors.stockNumber && <p className="text-red-600 font-bold text-base">{errors.stockNumber}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">{vinLabel(form.vehicleType).label}</label>
                <Input value={form.vin} onChange={e => setField("vin", e.target.value)} placeholder={vinLabel(form.vehicleType).placeholder} className="font-mono bg-white text-black" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Year *</label>
                <Input value={form.year} onChange={e => setField("year", e.target.value)} placeholder="e.g. 2022" inputMode="numeric" className="bg-white text-black" />
                {errors.year && <p className="text-red-600 font-bold text-base">{errors.year}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Make *</label>
                <Input value={form.make} onChange={e => setField("make", e.target.value)} placeholder="e.g. Ford" className="bg-white text-black" />
                {errors.make && <p className="text-red-600 font-bold text-base">{errors.make}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Model *</label>
                <Input value={form.model} onChange={e => setField("model", e.target.value)} placeholder="e.g. F-150" className="bg-white text-black" />
                {errors.model && <p className="text-red-600 font-bold text-base">{errors.model}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Mileage</label>
                <Input value={form.mileage} onChange={e => setField("mileage", e.target.value)} placeholder="e.g. 45000" inputMode="numeric" className="bg-white text-black" />
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Color</label>
                <Input value={form.color} onChange={e => setField("color", e.target.value)} placeholder="e.g. Red" className="bg-white text-black" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Status</label>
              <div className="flex flex-wrap gap-3">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField("status", opt.value)}
                    className={`px-4 py-2 rounded-lg border-4 font-black uppercase text-sm transition-colors ${
                      form.status === opt.value
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
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" size="lg" className="text-lg" onClick={() => setDialogOpen(false)}>
              CANCEL
            </Button>
            <Button type="button" size="lg" className="text-lg" disabled={isPending} onClick={handleSubmit}>
              {isPending ? "ADDING..." : "ADD VEHICLE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
