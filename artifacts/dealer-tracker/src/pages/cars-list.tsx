import { useState } from "react";
import { Link } from "wouter";
import { useListCars, useCreateCar } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Car, Plus, Key, Gauge, ChevronDown, ChevronRight } from "lucide-react";

const emptyForm = {
  stockNumber: "",
  year: String(new Date().getFullYear()),
  make: "",
  model: "",
  vin: "",
  color: "",
  mileage: "",
};

type FormState = typeof emptyForm;
type FormErrors = Partial<Record<keyof FormState, string>>;

function CarCard({ car }: { car: { id: number; stockNumber: string; year: number; make: string; model: string; vin?: string; color?: string; mileage?: number; sold: number } }) {
  return (
    <Link href={`/cars/${car.id}`} className="group outline-none">
      <div className={`h-full border-4 border-black bg-white rounded-2xl p-6 shadow-brutal ${car.sold ? "opacity-60" : ""}`}>
        <div className="flex justify-between items-start mb-6">
          <div className="bg-black text-white font-mono font-bold px-3 py-1 rounded text-lg">
            #{car.stockNumber}
          </div>
          <div className="flex items-center gap-2">
            {car.sold ? (
              <span className="bg-gray-500 text-white font-bold px-2 py-1 rounded text-sm uppercase">Sold</span>
            ) : null}
            {car.color && <div className="text-gray-600 font-bold">{car.color}</div>}
          </div>
        </div>
        <h2 className="text-3xl font-black uppercase leading-tight mb-6">
          {car.year} {car.make} <br />
          <span className="text-gray-500">{car.model}</span>
        </h2>
        <div className="space-y-3 font-mono font-bold bg-gray-100 p-4 rounded-xl border-2 border-black">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-gray-500" />
            <span className="truncate">{car.vin || 'NO VIN RECORDED'}</span>
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

export default function CarsList() {
  const queryClient = useQueryClient();
  const { data: cars, isLoading, isError } = useListCars();
  const { mutate: createCar, isPending } = useCreateCar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [soldOpen, setSoldOpen] = useState(false);

  const activeCars = cars?.filter(c => !c.sold) ?? [];
  const soldCars = cars?.filter(c => c.sold) ?? [];

  const openAddDialog = () => {
    setForm(emptyForm);
    setErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const setField = (field: keyof FormState, value: string) => {
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
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
        setDialogOpen(false);
      },
      onError: () => setSubmitError("Failed to save. Please try again."),
    });
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight">Active Vehicles</h1>
          <p className="text-xl text-muted-foreground mt-2 font-medium">Select a vehicle to log work or inspect.</p>
        </div>
        <Button size="lg" onClick={openAddDialog} className="w-full sm:w-auto text-xl py-8">
          <Plus className="w-8 h-8 mr-2" />
          ADD VEHICLE
        </Button>
      </div>

      {isLoading && <div className="text-center py-20 text-2xl font-bold">Loading vehicles...</div>}
      {isError && <div className="text-center py-20 text-2xl font-bold text-red-600">Failed to load vehicles.</div>}

      {!isLoading && !isError && activeCars.length === 0 && soldCars.length === 0 && (
        <div className="text-center py-20 border-4 border-dashed border-black rounded-3xl bg-gray-100">
          <Car className="w-24 h-24 mx-auto mb-6 opacity-50" />
          <h2 className="text-3xl font-black uppercase mb-4">Shop is Empty</h2>
          <p className="text-xl text-gray-600 mb-8">Add a vehicle to start tracking inspections and maintenance.</p>
          <Button size="lg" onClick={openAddDialog}>ADD FIRST VEHICLE</Button>
        </div>
      )}

      {!isLoading && !isError && activeCars.length === 0 && soldCars.length > 0 && (
        <div className="text-center py-16 border-4 border-dashed border-black rounded-3xl bg-gray-100 mb-8">
          <Car className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-black uppercase mb-2">No Active Vehicles</h2>
          <p className="text-lg text-gray-600">All vehicles have been marked as sold.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeCars.map(car => <CarCard key={car.id} car={car} />)}
      </div>

      {soldCars.length > 0 && (
        <div className="mt-12 border-4 border-gray-400 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setSoldOpen(prev => !prev)}
            className="w-full flex items-center justify-between gap-4 p-5 bg-gray-100 text-left font-black uppercase text-xl"
          >
            <span>Sold Vehicles ({soldCars.length})</span>
            {soldOpen ? <ChevronDown className="w-8 h-8 flex-shrink-0" /> : <ChevronRight className="w-8 h-8 flex-shrink-0" />}
          </button>
          {soldOpen && (
            <div className="p-6 bg-gray-50 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 border-t-4 border-gray-400">
              {soldCars.map(car => <CarCard key={car.id} car={car} />)}
            </div>
          )}
        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Stock Number *</label>
                <Input value={form.stockNumber} onChange={e => setField("stockNumber", e.target.value)} placeholder="e.g. 1045A" />
                {errors.stockNumber && <p className="text-red-600 font-bold text-base">{errors.stockNumber}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">VIN</label>
                <Input value={form.vin} onChange={e => setField("vin", e.target.value)} placeholder="17-character VIN" className="font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Year *</label>
                <Input value={form.year} onChange={e => setField("year", e.target.value)} placeholder="e.g. 2022" inputMode="numeric" />
                {errors.year && <p className="text-red-600 font-bold text-base">{errors.year}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Make *</label>
                <Input value={form.make} onChange={e => setField("make", e.target.value)} placeholder="e.g. Ford" />
                {errors.make && <p className="text-red-600 font-bold text-base">{errors.make}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Model *</label>
                <Input value={form.model} onChange={e => setField("model", e.target.value)} placeholder="e.g. F-150" />
                {errors.model && <p className="text-red-600 font-bold text-base">{errors.model}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Mileage</label>
                <Input value={form.mileage} onChange={e => setField("mileage", e.target.value)} placeholder="e.g. 45000" inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <label className="text-base font-black uppercase block">Color</label>
                <Input value={form.color} onChange={e => setField("color", e.target.value)} placeholder="e.g. Red" />
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
