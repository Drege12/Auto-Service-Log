import { useState } from "react";
import { Link } from "wouter";
import { useListCars, useCreateCar } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Car, Plus, Key, Hash, Gauge } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  stockNumber: z.string().min(1, "Stock number is required"),
  year: z.coerce.number().min(1900, "Invalid year").max(2100, "Invalid year"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  vin: z.string().optional(),
  color: z.string().optional(),
  mileage: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CarsList() {
  const queryClient = useQueryClient();
  const { data: cars, isLoading, isError } = useListCars();
  const { mutate: createCar, isPending } = useCreateCar();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stockNumber: "",
      year: new Date().getFullYear(),
      make: "",
      model: "",
      vin: "",
      color: "",
      mileage: undefined,
    }
  });

  const onSubmit = (values: FormValues) => {
    createCar({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/cars`] });
        setDialogOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight">Active Vehicles</h1>
          <p className="text-xl text-muted-foreground mt-2 font-medium">Select a vehicle to log work or inspect.</p>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)} className="w-full sm:w-auto text-xl py-8">
          <Plus className="w-8 h-8 mr-2" />
          ADD VEHICLE
        </Button>
      </div>

      {isLoading && <div className="text-center py-20 text-2xl font-bold">Loading vehicles...</div>}
      {isError && <div className="text-center py-20 text-2xl font-bold text-destructive">Failed to load vehicles.</div>}

      {!isLoading && !isError && cars?.length === 0 && (
        <div className="text-center py-20 border-4 border-dashed border-black rounded-3xl bg-secondary">
          <Car className="w-24 h-24 mx-auto mb-6 opacity-50" />
          <h2 className="text-3xl font-black uppercase mb-4">Shop is Empty</h2>
          <p className="text-xl text-muted-foreground mb-8">Add a vehicle to start tracking inspections and maintenance.</p>
          <Button size="lg" onClick={() => setDialogOpen(true)}>ADD FIRST VEHICLE</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cars?.map((car) => (
          <Link key={car.id} href={`/cars/${car.id}`} className="group outline-none">
            <div className="h-full border-4 border-black bg-card rounded-2xl p-6 shadow-brutal transition-all duration-200 group-hover:-translate-y-2 group-hover:shadow-brutal-lg group-focus-visible:ring-8 ring-black ring-offset-4">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-black text-white font-mono font-bold px-3 py-1 rounded text-lg shadow-brutal-sm">
                  #{car.stockNumber}
                </div>
                {car.color && (
                  <div className="flex items-center gap-2 text-muted-foreground font-bold">
                    <div className="w-6 h-6 rounded-full border-2 border-black" style={{ backgroundColor: car.color.toLowerCase() }} />
                    {car.color}
                  </div>
                )}
              </div>
              
              <h2 className="text-3xl font-black uppercase leading-tight mb-6">
                {car.year} {car.make} <br/>
                <span className="text-muted-foreground">{car.model}</span>
              </h2>

              <div className="space-y-3 font-mono font-bold bg-secondary p-4 rounded-xl border-2 border-black">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <span className="truncate">{car.vin || 'NO VIN RECORDED'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Gauge className="w-5 h-5 text-muted-foreground" />
                  <span>{car.mileage ? `${car.mileage.toLocaleString()} mi` : 'UNKNOWN MILEAGE'}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ADD NEW VEHICLE</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Stock Number *</label>
                <Input {...form.register("stockNumber")} placeholder="e.g. 1045A" />
                {form.formState.errors.stockNumber && <p className="text-destructive font-bold">{form.formState.errors.stockNumber.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">VIN</label>
                <Input {...form.register("vin")} placeholder="17-character VIN" className="font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Year *</label>
                <Input type="number" {...form.register("year")} />
                {form.formState.errors.year && <p className="text-destructive font-bold">{form.formState.errors.year.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Make *</label>
                <Input {...form.register("make")} placeholder="e.g. Ford" />
                {form.formState.errors.make && <p className="text-destructive font-bold">{form.formState.errors.make.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Model *</label>
                <Input {...form.register("model")} placeholder="e.g. F-150" />
                {form.formState.errors.model && <p className="text-destructive font-bold">{form.formState.errors.model.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Mileage</label>
                <Input type="number" {...form.register("mileage")} placeholder="e.g. 45000" />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Color</label>
                <Input {...form.register("color")} placeholder="e.g. Red" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
              <Button type="submit" size="lg" disabled={isPending}>
                {isPending ? "ADDING..." : "ADD VEHICLE"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
