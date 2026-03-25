import { useState } from "react";
import { Link } from "wouter";
import { useListCars, useCreateCar, CreateCarStatus, CreateCarCarType, CreateCarVehicleType, CreateCarVehicleSubtype } from "@workspace/api-client-react";
import { getSubtypesForVehicleType, getDefaultSubtype, vehicleSubtypeLabel } from "@/lib/inspection-template";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { vinLabel, mileageLabel } from "@/lib/vehicle-labels";

const STATUS_OPTIONS = [
  { value: "", label: "— No Status —" },
  { value: "in_service", label: "In Service" },
  { value: "ready", label: "Ready" },
  { value: "on_hold", label: "On Hold" },
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
    default:
      return null;
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
};

export default function CarsList() {
  const queryClient = useQueryClient();
  const { data: cars, isLoading, isError } = useListCars();
  const { mutate: createCar, isPending: isCreating } = useCreateCar();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [showSold, setShowSold] = useState(false);
  const [soldCollapsed, setSoldCollapsed] = useState(true);

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
    setForm({ ...emptyForm });
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const validate = () => {
    const newErrors: FormErrors = {};
    if (!form.stockNumber.trim()) newErrors.stockNumber = "Required";
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
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(c =>
      `${c.year} ${c.make} ${c.model} ${c.stockNumber} ${c.vin || ""} ${c.owner || ""}`.toLowerCase().includes(q)
    );
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
        <Button onClick={openAddDialog} size="lg" className="font-black uppercase text-xl px-6 py-3">
          <Plus className="w-6 h-6 mr-2" /> Add
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6">
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
                    <span className="bg-secondary text-secondary-foreground font-black px-3 py-1 rounded text-lg tracking-wider">
                      #{car.stockNumber}
                    </span>
                    {car.carType === "personal" && (
                      <span className="bg-teal-700 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">Personal</span>
                    )}
                    {vt !== "car" || car.vehicleSubtype ? (
                      <span className="bg-slate-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                        {vehicleSubtypeLabel(vt, car.vehicleSubtype) || (vehicleTypeLabels[vt] ?? vt)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {car.sold
                      ? <span className="bg-gray-500 text-white font-black px-3 py-1 rounded text-sm uppercase">Sold</span>
                      : statusBadge(car.status)
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
                          <span className="bg-secondary text-secondary-foreground font-black px-3 py-1 rounded text-lg tracking-wider">
                            #{car.stockNumber}
                          </span>
                          <span className="bg-gray-500 text-white font-black px-3 py-1 rounded text-sm uppercase">Sold</span>
                          {car.carType === "personal" && (
                            <span className="bg-teal-700 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">Personal</span>
                          )}
                          {vt !== "car" || car.vehicleSubtype ? (
                            <span className="bg-slate-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-wide">
                              {vehicleSubtypeLabel(vt, car.vehicleSubtype) || (vehicleTypeLabels[vt] ?? vt)}
                            </span>
                          ) : null}
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
                placeholder={vinLabel(form.vehicleType).placeholder}
                className="bg-white text-black"
              />
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

            <div className="space-y-2">
              <label className="text-base font-black uppercase block">Ownership</label>
              <div className="flex gap-3">
                {[{ value: "dealer", label: "Dealership" }, { value: "personal", label: "Personal" }].map(opt => (
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
              </div>
            )}

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
    </Layout>
  );
}
