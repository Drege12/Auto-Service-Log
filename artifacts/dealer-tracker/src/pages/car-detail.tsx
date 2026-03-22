import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetCar, useUpdateCar, useDeleteCar, useMarkCarAsSold } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InspectionsTab } from "@/components/inspections-tab";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { TodosTab } from "@/components/todos-tab";
import { ArrowLeft, Edit2, Trash2, Key, Gauge, Tag } from "lucide-react";
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

export default function CarDetail() {
  const [, params] = useRoute("/cars/:id");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : 0;
  
  const queryClient = useQueryClient();
  const { data: car, isLoading, isError } = useGetCar(carId);
  const { mutate: updateCar, isPending: isUpdating } = useUpdateCar();
  const { mutate: deleteCar } = useDeleteCar();
  const { mutate: markAsSold, isPending: isMarkingAsSold } = useMarkCarAsSold();

  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const openEditDialog = () => {
    if (car) {
      form.reset({
        stockNumber: car.stockNumber,
        year: car.year,
        make: car.make,
        model: car.model,
        vin: car.vin || "",
        color: car.color || "",
        mileage: car.mileage || undefined,
      });
      setDialogOpen(true);
    }
  };

  const onSubmit = (values: FormValues) => {
    updateCar({ carId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/cars`] });
        setDialogOpen(false);
      }
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
    const isSold = Boolean(car?.sold);
    const confirmMsg = isSold
      ? `Mark ${car?.year} ${car?.make} ${car?.model} as active again?`
      : `Mark ${car?.year} ${car?.make} ${car?.model} as sold? It will move to the Sold Vehicles list.`;
    if (confirm(confirmMsg)) {
      markAsSold({ carId, data: { sold: !isSold } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/cars`] });
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}`] });
          if (!isSold) setLocation("/");
        }
      });
    }
  };

  if (isLoading) return <Layout><div className="text-center py-20 text-3xl font-black">Loading vehicle data...</div></Layout>;
  if (isError || !car) return <Layout><div className="text-center py-20 text-3xl font-black text-destructive">Vehicle not found.</div></Layout>;

  return (
    <Layout>
      <div className="mb-8">
        <Button variant="ghost" onClick={() => setLocation("/")} className="mb-6 -ml-4">
          <ArrowLeft className="w-6 h-6 mr-2" />
          BACK TO CARS
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
            </div>
            
            <div className="flex flex-wrap gap-6 mt-4 font-mono text-xl font-bold">
              <div className="flex items-center gap-2">
                <Key className="w-6 h-6 text-muted-foreground" />
                {car.vin || 'NO VIN'}
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="w-6 h-6 text-muted-foreground" />
                {car.mileage ? `${car.mileage.toLocaleString()} mi` : 'UNKNOWN MILEAGE'}
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
              disabled={isMarkingAsSold}
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

      <Tabs defaultValue="inspection" className="w-full">
        <TabsList className="flex flex-col sm:flex-row h-auto border-b-0 gap-2 sm:gap-4 mb-8">
          <TabsTrigger value="inspection" className="w-full sm:w-auto">INSPECTION</TabsTrigger>
          <TabsTrigger value="maintenance" className="w-full sm:w-auto">MAINTENANCE</TabsTrigger>
          <TabsTrigger value="todos" className="w-full sm:w-auto">NEEDS DONE</TabsTrigger>
        </TabsList>
        
        <div className="bg-white p-6 sm:p-8 rounded-2xl border-4 border-black shadow-brutal min-h-[500px]">
          <TabsContent value="inspection" className="mt-0">
            <InspectionsTab carId={carId} />
          </TabsContent>
          <TabsContent value="maintenance" className="mt-0">
            <MaintenanceTab carId={carId} />
          </TabsContent>
          <TabsContent value="todos" className="mt-0">
            <TodosTab carId={carId} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>EDIT VEHICLE DETAILS</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Stock Number *</label>
                <Input {...form.register("stockNumber")} />
                {form.formState.errors.stockNumber && <p className="text-destructive font-bold">{form.formState.errors.stockNumber.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">VIN</label>
                <Input {...form.register("vin")} className="font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Year *</label>
                <Input type="number" {...form.register("year")} />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Make *</label>
                <Input {...form.register("make")} />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Model *</label>
                <Input {...form.register("model")} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Mileage</label>
                <Input type="number" {...form.register("mileage")} />
              </div>
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">Color</label>
                <Input {...form.register("color")} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
              <Button type="submit" size="lg" disabled={isUpdating}>
                {isUpdating ? "SAVING..." : "SAVE CHANGES"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
