import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetCar, useUpdateCar, useDeleteCar, CreateCarStatus, CreateCarCarType, CreateCarVehicleType, CreateCarVehicleSubtype } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InspectionsTab } from "@/components/inspections-tab";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { MileageTab } from "@/components/mileage-tab";
import { TodosTab } from "@/components/todos-tab";
import { CostsTab } from "@/components/costs-tab";
import { NotesTab } from "@/components/notes-tab";
import { ServiceIntervalsTab } from "@/components/service-intervals-tab";
import { ArrowLeft, Edit2, Trash2, Key, Gauge, Tag, User, Phone, Mail, EyeOff, Wrench, AlertTriangle, Search } from "lucide-react";
import { vinLabel, mileageLabel } from "@/lib/vehicle-labels";
import { getSubtypesForVehicleType, getDefaultSubtype, vehicleSubtypeLabel } from "@/lib/inspection-template";

// Strip any prior "[VIN Decode]" block (the marker line + all immediately
// following Key: Value lines for known decode fields) so re-decoding a VIN
// replaces the existing block instead of appending duplicates.
function stripVinDecodeBlock(notes: string): string {
  if (!notes) return "";
  const keyRe = /^(Trim|Body|Engine|Drive|Trans|Fuel|Built in):/i;
  const lines = notes.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (line.trim() === "[VIN Decode]") { skipping = true; continue; }
    if (skipping) {
      if (keyRe.test(line.trim()) || line.trim() === "") continue;
      skipping = false;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
}

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
    case "in_service":   return "bg-blue-600 text-white border-blue-600";
    case "ready":        return "bg-green-600 text-white border-green-600";
    case "on_hold":      return "bg-amber-500 text-white border-amber-500";
    case "service_due":  return "bg-amber-500 text-white border-amber-500";
    case "needs_attention": return "bg-orange-600 text-white border-orange-600";
    case "out_of_service":  return "bg-red-600 text-white border-red-600";
    default:             return "bg-black text-white border-black";
  }
}

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

const TYPE_OPTIONS = [
  { value: "dealer", label: "Work" },
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

  // VIN decode state for the edit form
  type EditVinDecode = {
    year: string; make: string; model: string; trim: string; bodyClass: string; fuel: string;
    cylinders: string; displacement: string; driveType: string; transmission: string; plantCountry: string;
  };
  const [editVinDecode, setEditVinDecode] = useState<EditVinDecode | null>(null);
  const [editVinDecoding, setEditVinDecoding] = useState(false);
  const [editVinDecodeError, setEditVinDecodeError] = useState("");
  // The formatted notes string to append on save (set when user clicks Apply)
  const [pendingVinNotes, setPendingVinNotes] = useState<string | null>(null);

  const decodeEditVin = async () => {
    const trimmed = editForm.vin.trim().toUpperCase();
    if (trimmed.length < 17) { setEditVinDecodeError("A full 17-character VIN is required."); return; }
    setEditVinDecoding(true); setEditVinDecodeError(""); setEditVinDecode(null);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${trimmed}?format=json`);
      const json = await res.json();
      const r = json?.Results?.[0];
      if (!r || r.ErrorCode !== "0") { setEditVinDecodeError(r?.ErrorText || "Could not decode this VIN."); setEditVinDecoding(false); return; }
      setEditVinDecode({
        year: r.ModelYear || "", make: r.Make || "", model: r.Model || "",
        trim: r.Trim || "", bodyClass: r.BodyClass || "", fuel: r.FuelTypePrimary || "",
        cylinders: r.EngineCylinders || "",
        displacement: r.DisplacementL ? `${Number(r.DisplacementL).toFixed(1)}L` : "",
        driveType: r.DriveType || "", transmission: r.TransmissionStyle || "",
        plantCountry: r.PlantCountry || "",
      });
    } catch { setEditVinDecodeError("Could not reach VIN decoder. Check your connection."); }
    setEditVinDecoding(false);
  };

  const applyEditVinDecode = (decoded: EditVinDecode) => {
    const titleCase = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
    const engineParts = [decoded.cylinders && `${decoded.cylinders} cyl`, decoded.displacement].filter(Boolean).join(" ");
    const noteLines: string[] = ["[VIN Decode]"];
    if (decoded.trim)         noteLines.push(`Trim: ${decoded.trim}`);
    if (decoded.bodyClass)    noteLines.push(`Body: ${decoded.bodyClass}`);
    if (engineParts)          noteLines.push(`Engine: ${engineParts}`);
    if (decoded.driveType)    noteLines.push(`Drive: ${decoded.driveType}`);
    if (decoded.transmission) noteLines.push(`Trans: ${decoded.transmission}`);
    if (decoded.fuel)         noteLines.push(`Fuel: ${decoded.fuel}`);
    if (decoded.plantCountry) noteLines.push(`Built in: ${decoded.plantCountry}`);
    setPendingVinNotes(noteLines.join("\n"));
    setEditForm(f => ({
      ...f,
      year: decoded.year || f.year,
      make: decoded.make ? titleCase(decoded.make) : f.make,
      model: decoded.model ? titleCase(decoded.model) : f.model,
    }));
    setEditVinDecode(null);
  };

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
      setEditVinDecode(null);
      setEditVinDecodeError("");
      setPendingVinNotes(null);
      setDialogOpen(true);
    }
  };

  const handleEditSave = () => {
    if (editForm.carType !== "personal" && !editForm.stockNumber.trim()) { setEditError("Stock number is required."); return; }
    if (!editForm.year.trim() || isNaN(Number(editForm.year))) { setEditError("A valid year is required."); return; }
    if (!editForm.make.trim()) { setEditError("Make is required."); return; }
    if (!editForm.model.trim()) { setEditError("Model is required."); return; }
    setEditError("");
    const stockNumber = editForm.carType === "personal" && !editForm.stockNumber.trim()
      ? `PERSONAL-${Date.now()}`
      : editForm.stockNumber.trim();
    const data = {
      stockNumber,
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
      onSuccess: async () => {
        // If the user decoded a VIN and clicked Apply, append those details to the vehicle notes
        if (pendingVinNotes) {
          const rawNotes = (car as unknown as { notes?: string | null })?.notes || "";
          const cleaned = stripVinDecodeBlock(rawNotes);
          const merged = cleaned ? `${cleaned}\n\n${pendingVinNotes}` : pendingVinNotes;
          const session = (() => { try { return JSON.parse(localStorage.getItem("dt_mechanic") || "{}"); } catch { return {}; } })();
          await fetch(`${BASE}/api/cars/${carId}/notes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "X-Mechanic-Id": String(session.mechanicId ?? "") },
            body: JSON.stringify({ notes: merged }),
          }).catch(() => {});
          setPendingVinNotes(null);
          queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}/notes`] });
        }
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
  const [clientContact, setClientContact] = useState<ContactInfo | null>(null);

  // Abuse report dialog
  const [abuseOpen, setAbuseOpen] = useState(false);
  const [abuseReason, setAbuseReason] = useState("");
  const [abuseSubmitting, setAbuseSubmitting] = useState(false);
  const [abuseError, setAbuseError] = useState("");
  const [abuseDone, setAbuseDone] = useState(false);
  const [abuseTargetId, setAbuseTargetId] = useState<number | null>(null);

  // VIN decode (NHTSA public API)
  type VinDecodeResult = {
    year: string; make: string; model: string; trim: string;
    bodyClass: string; cylinders: string; displacement: string;
    driveType: string; transmission: string; fuel: string;
    plantCountry: string;
  };
  const [vinDecode, setVinDecode] = useState<VinDecodeResult | null>(null);
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinDecodeError, setVinDecodeError] = useState("");
  const [vinDecodeOpen, setVinDecodeOpen] = useState(false);

  const decodeVin = async (vin: string) => {
    const trimmed = vin.trim().toUpperCase();
    if (!trimmed || trimmed.length < 17) { setVinDecodeError("A full 17-character VIN is required."); setVinDecodeOpen(true); return; }
    setVinDecoding(true); setVinDecodeError(""); setVinDecodeOpen(true); setVinDecode(null);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${trimmed}?format=json`);
      const json = await res.json();
      const r = json?.Results?.[0];
      if (!r || r.ErrorCode !== "0") {
        setVinDecodeError(r?.ErrorText || "Could not decode this VIN."); setVinDecoding(false); return;
      }
      setVinDecode({
        year: r.ModelYear || "", make: r.Make || "", model: r.Model || "", trim: r.Trim || "",
        bodyClass: r.BodyClass || "", cylinders: r.EngineCylinders || "",
        displacement: r.DisplacementL ? `${Number(r.DisplacementL).toFixed(1)}L` : "",
        driveType: r.DriveType || "", transmission: r.TransmissionStyle || "",
        fuel: r.FuelTypePrimary || "", plantCountry: r.PlantCountry || "",
      });
    } catch { setVinDecodeError("Could not reach VIN decoder. Check your connection."); }
    setVinDecoding(false);
  };

  const viewerSession = (() => {
    try { return JSON.parse(localStorage.getItem("dt_mechanic") || "{}") as { mechanicId?: number; isAdmin?: boolean; role?: string }; }
    catch { return {}; }
  })();

  useEffect(() => {
    if (!car?.mechanicId) return;
    // Don't fetch if the viewer IS the assigned technician — no point showing your own info
    if (car.mechanicId === viewerSession.mechanicId) return;
    fetch(`${BASE}/api/mechanics/${car.mechanicId}/contact`, {
      headers: { "X-Mechanic-Id": String(viewerSession.mechanicId ?? "") },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: ContactInfo | null) => setContact(data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car?.mechanicId]);

  // Linked-party contact info:
  //  • For mechanics: shows the linked client/driver (teal "Client" banner)
  //  • For drivers who OWN the car (mechanicId === viewerMechanicId): shows the linked mechanic (teal "Technician" banner)
  //    This covers the case where the car was created by the driver and a mechanic VIN-linked via the old path,
  //    leaving mechanicId = driverId and linkedMechanicId = mechId.
  const linkedMechanicId = (car as unknown as { linkedMechanicId?: number | null })?.linkedMechanicId;
  useEffect(() => {
    if (!linkedMechanicId) return;
    // Don't fetch if the viewer IS the linked party (no point showing your own info)
    if (linkedMechanicId === viewerSession.mechanicId) return;
    // For drivers: only show when they own the car (mechanicId = their ID),
    // meaning linkedMechanicId is the mechanic/tech attached to their vehicle.
    // When car.mechanicId is someone else's (not theirs), the blue tech banner already covers it.
    if (viewerSession.role === "driver" && (car as unknown as { mechanicId?: number | null })?.mechanicId !== viewerSession.mechanicId) return;
    fetch(`${BASE}/api/mechanics/${linkedMechanicId}/contact`, {
      headers: { "X-Mechanic-Id": String(viewerSession.mechanicId ?? "") },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: ContactInfo | null) => setClientContact(data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedMechanicId, car?.mechanicId]);

  const openAbuseDialog = (reportedId: number) => {
    setAbuseTargetId(reportedId);
    setAbuseReason("");
    setAbuseError("");
    setAbuseDone(false);
    setAbuseOpen(true);
  };

  const handleReportAbuse = async () => {
    if (!abuseTargetId) return;
    setAbuseSubmitting(true);
    setAbuseError("");
    try {
      const res = await fetch(`${BASE}/api/abuse-reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Mechanic-Id": String(viewerSession.mechanicId ?? ""),
        },
        body: JSON.stringify({ reportedId: abuseTargetId, carId, reason: abuseReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setAbuseError(err.error || "Could not submit report.");
        return;
      }
      setAbuseDone(true);
    } catch {
      setAbuseError("Could not reach the server.");
    } finally {
      setAbuseSubmitting(false);
    }
  };

  if (isLoading) return <Layout><div className="text-center py-20 text-3xl font-black">Loading vehicle data...</div></Layout>;
  if (isError || !car) return <Layout><div className="text-center py-20 text-3xl font-black text-destructive">Vehicle not found.</div></Layout>;

  const isPersonal = car.carType === "personal";
  const carLabel = isPersonal
    ? `${car.year} ${car.make} ${car.model}`
    : `${car.year} ${car.make} ${car.model} #${car.stockNumber}`;

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
              {!isPersonal && (
                <span className="bg-black text-white font-mono font-bold px-4 py-2 rounded-lg text-2xl shadow-brutal-sm">
                  #{car.stockNumber}
                </span>
              )}
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
              <div className="flex items-center gap-2 flex-wrap">
                <Key className="w-6 h-6 text-muted-foreground" />
                {car.vin || vinLabel(car.vehicleType).empty}
                {car.vin && (
                  <button
                    type="button"
                    onClick={() => decodeVin(car.vin!)}
                    className="ml-1 flex items-center gap-1 text-xs font-black uppercase bg-indigo-100 border-2 border-indigo-500 text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-200 transition-colors"
                  >
                    <Search className="w-3 h-3" /> {vinDecoding ? "Decoding..." : "Decode"}
                  </button>
                )}
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
          </div>
        </div>
      </div>

      {/* VIN Decode result panel */}
      {vinDecodeOpen && (
        <div className="mb-6 rounded-2xl border-4 border-indigo-500 bg-indigo-50 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-black uppercase text-indigo-900 text-base flex items-center gap-2">
              <Search className="w-4 h-4" /> VIN Decode Result
            </span>
            <button type="button" onClick={() => setVinDecodeOpen(false)} className="text-indigo-500 font-black text-lg leading-none">✕</button>
          </div>
          {vinDecoding && <p className="text-indigo-700 font-bold">Decoding VIN...</p>}
          {vinDecodeError && <p className="text-red-700 font-bold">{vinDecodeError}</p>}
          {vinDecode && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-mono">
              {[
                ["Year", vinDecode.year], ["Make", vinDecode.make], ["Model", vinDecode.model],
                ["Trim", vinDecode.trim], ["Body", vinDecode.bodyClass], ["Fuel", vinDecode.fuel],
                ["Engine", [vinDecode.cylinders && `${vinDecode.cylinders} cyl`, vinDecode.displacement].filter(Boolean).join(" ")],
                ["Drive", vinDecode.driveType], ["Trans", vinDecode.transmission],
                ["Built in", vinDecode.plantCountry],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="font-black uppercase text-indigo-700 min-w-[56px]">{label}:</span>
                  <span className="text-indigo-900 uppercase">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
          <button
            type="button"
            onClick={() => contact && openAbuseDialog(contact.id)}
            className="ml-auto flex items-center gap-1 text-red-700 border-2 border-red-400 bg-white font-black px-3 py-1 rounded text-xs uppercase tracking-wide hover:bg-red-50"
          >
            <AlertTriangle className="w-3 h-3" /> Report Abuse
          </button>
        </div>
      )}

      {/* Linked-party contact banner — "Client" for mechanics, "Technician" for drivers who own the car */}
      {clientContact && (
        <div className={`mb-6 rounded-2xl border-4 px-6 py-4 flex flex-wrap items-center gap-4 ${
          clientContact.visible
            ? "bg-teal-50 border-teal-700"
            : "bg-gray-100 border-gray-400"
        }`}>
          <span className={`font-black uppercase text-xs px-2 py-1 rounded ${
            clientContact.visible ? "bg-teal-700 text-white" : "bg-gray-400 text-white"
          }`}>{viewerSession.role === "driver" ? "Technician" : "Client"}</span>
          <div className="flex items-center gap-2">
            <User className={`w-5 h-5 ${clientContact.visible ? "text-teal-800" : "text-gray-500"}`} />
            <span className={`font-black uppercase text-lg ${clientContact.visible ? "text-teal-900" : "text-gray-600"}`}>
              {clientContact.displayName}
            </span>
          </div>
          {clientContact.visible && clientContact.phone && (
            <a href={`tel:${clientContact.phone}`} className="flex items-center gap-2 font-bold text-teal-900 underline text-lg">
              <Phone className="w-5 h-5" /> {clientContact.phone}
            </a>
          )}
          {clientContact.visible && clientContact.email && (
            <a href={`mailto:${clientContact.email}`} className="flex items-center gap-2 font-bold text-teal-900 underline text-lg">
              <Mail className="w-5 h-5" /> {clientContact.email}
            </a>
          )}
          {clientContact.visible && !clientContact.phone && !clientContact.email && (
            <span className="font-bold text-teal-700">No contact info on file.</span>
          )}
          {!clientContact.visible && (
            <span className="flex items-center gap-2 font-bold text-gray-500">
              <EyeOff className="w-4 h-4" /> Contact info is private
            </span>
          )}
          <button
            type="button"
            onClick={() => openAbuseDialog(clientContact.id)}
            className="ml-auto flex items-center gap-1 text-red-700 border-2 border-red-400 bg-white font-black px-3 py-1 rounded text-xs uppercase tracking-wide hover:bg-red-50"
          >
            <AlertTriangle className="w-3 h-3" /> Report Abuse
          </button>
        </div>
      )}

      {viewerSession.role === "driver" && !(car as { mechanicId?: number | null }).mechanicId && (
        <div className="mb-6 bg-gray-100 border-4 border-gray-400 rounded-2xl px-6 py-4 flex items-center gap-3 flex-wrap">
          <span className="bg-gray-500 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Technician
          </span>
          <span className="font-black text-gray-600 text-lg uppercase">No technician assigned yet</span>
        </div>
      )}

      {viewerSession.role === "driver"
        && (car as { mechanicName?: string | null }).mechanicName
        && (car as { mechanicId?: number | null }).mechanicId !== viewerSession.mechanicId && (
        <div className="mb-6 bg-amber-50 border-4 border-amber-500 rounded-2xl px-6 py-4 flex items-center gap-3 flex-wrap">
          <span className="bg-amber-500 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-wide flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Your Technician
          </span>
          <span className="font-black text-amber-900 text-xl uppercase">
            {(car as { mechanicName?: string | null }).mechanicName}
          </span>
        </div>
      )}

      <Tabs defaultValue="inspection" className="w-full">
        <TabsList className="flex flex-col sm:flex-row h-auto border-b-0 gap-2 sm:gap-4 mb-8">
          <TabsTrigger value="inspection" className="w-full sm:w-auto">INSPECTION</TabsTrigger>
          <TabsTrigger value="maintenance" className="w-full sm:w-auto">MAINTENANCE</TabsTrigger>
          <TabsTrigger value="todos" className="w-full sm:w-auto">NEEDS DONE</TabsTrigger>
          <TabsTrigger value="mileage" className="w-full sm:w-auto">MILEAGE</TabsTrigger>
          <TabsTrigger value="costs" className="w-full sm:w-auto">COSTS</TabsTrigger>
          <TabsTrigger value="service" className="w-full sm:w-auto">SERVICE</TabsTrigger>
          <TabsTrigger value="notes" className="w-full sm:w-auto">NOTES</TabsTrigger>
        </TabsList>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border-4 border-black shadow-brutal min-h-[500px]">
          <TabsContent value="inspection" className="mt-0">
            <InspectionsTab
              carId={carId}
              carLabel={carLabel}
              vehicleType={car.vehicleType}
              vehicleSubtype={car.vehicleSubtype}
              userRole={viewerSession.role}
              isOwnCar={!(car as { linkedMechanicId?: number | null }).linkedMechanicId && viewerSession.role !== "driver"}
            />
          </TabsContent>
          <TabsContent value="maintenance" className="mt-0">
            <MaintenanceTab carId={carId} carLabel={carLabel} />
          </TabsContent>
          <TabsContent value="todos" className="mt-0">
            <TodosTab carId={carId} carLabel={carLabel} />
          </TabsContent>
          <TabsContent value="mileage" className="mt-0">
            <MileageTab carId={carId} carLabel={carLabel} initialMileage={car.mileage ?? undefined} originalMileage={car.originalMileage ?? undefined} vehicleType={car.vehicleType} isDriver={viewerSession.role === "driver"} />
          </TabsContent>
          <TabsContent value="costs" className="mt-0">
            <CostsTab
              carId={carId}
              carLabel={carLabel}
              repairNotes={car.repairNotes ?? undefined}
              partsCost={car.partsCost ?? undefined}
              laborHours={car.laborHours ?? undefined}
              laborRate={car.laborRate ?? undefined}
              actualRepairNotes={car.actualRepairNotes ?? undefined}
              actualPartsCost={car.actualPartsCost ?? undefined}
              actualLaborHours={car.actualLaborHours ?? undefined}
            />
          </TabsContent>
          <TabsContent value="service" className="mt-0">
            <ServiceIntervalsTab carId={carId} vehicleType={car.vehicleType} />
          </TabsContent>
          <TabsContent value="notes" className="mt-0">
            <NotesTab carId={carId} initialNotes={car.notes} />
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
              {editForm.carType !== "personal" && (
                <div className="space-y-2">
                  <label className="text-lg font-bold uppercase">Stock Number *</label>
                  <Input
                    className="bg-white text-black"
                    value={editForm.stockNumber}
                    onChange={e => setEditForm(f => ({ ...f, stockNumber: e.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-lg font-bold uppercase">{vinLabel(editForm.vehicleType).label}</label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono bg-white text-black flex-1"
                    value={editForm.vin}
                    placeholder={vinLabel(editForm.vehicleType).placeholder}
                    onChange={e => { setEditForm(f => ({ ...f, vin: e.target.value })); setEditVinDecode(null); setEditVinDecodeError(""); setPendingVinNotes(null); }}
                  />
                  {editForm.vehicleType === "car" && editForm.vin.trim().length >= 17 && (
                    <button
                      type="button"
                      onClick={decodeEditVin}
                      className="px-3 py-2 rounded-xl border-2 border-indigo-500 bg-indigo-100 text-indigo-800 font-black text-xs uppercase whitespace-nowrap hover:bg-indigo-200 transition-colors"
                    >
                      {editVinDecoding ? "..." : "Decode VIN"}
                    </button>
                  )}
                </div>
                {editVinDecodeError && <p className="text-sm font-bold text-red-600">{editVinDecodeError}</p>}
                {pendingVinNotes && !editVinDecode && (
                  <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-300 rounded-lg px-3 py-2">
                    VIN details will be added to Notes on save.
                    <button type="button" onClick={() => setPendingVinNotes(null)} className="ml-2 text-indigo-400 hover:text-indigo-700 font-black">✕ Cancel</button>
                  </p>
                )}
                {editVinDecode && (
                  <div className="bg-indigo-50 border-2 border-indigo-400 rounded-xl p-3 mt-1 space-y-2">
                    <p className="text-xs font-black uppercase text-indigo-800">NHTSA Decode Result</p>
                    <div className="text-sm font-mono text-indigo-900 space-y-0.5">
                      {[
                        ["Year", editVinDecode.year], ["Make", editVinDecode.make], ["Model", editVinDecode.model],
                        ["Trim", editVinDecode.trim], ["Body", editVinDecode.bodyClass],
                        ["Engine", [editVinDecode.cylinders && `${editVinDecode.cylinders} cyl`, editVinDecode.displacement].filter(Boolean).join(" ")],
                        ["Drive", editVinDecode.driveType], ["Trans", editVinDecode.transmission],
                        ["Fuel", editVinDecode.fuel], ["Built in", editVinDecode.plantCountry],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label}><span className="font-black">{label}:</span> {value}</div>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-600 font-bold">Extra details will be appended to the vehicle's Notes on save.</p>
                    <button
                      type="button"
                      onClick={() => applyEditVinDecode(editVinDecode)}
                      className="w-full py-2 rounded-xl bg-indigo-600 text-white font-black text-sm uppercase hover:bg-indigo-700 transition-colors"
                    >
                      Fill in Year / Make / Model + Queue Notes
                    </button>
                  </div>
                )}
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
                {(editForm.carType === "personal" ? PERSONAL_STATUS_OPTIONS : STATUS_OPTIONS).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, status: opt.value }))}
                    className={`px-4 py-2 rounded-lg border-4 font-black uppercase text-sm transition-colors ${
                      editForm.status === opt.value
                        ? statusActiveColor(opt.value)
                        : "bg-white text-black border-black"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {editError && <p className="text-destructive font-bold text-lg">{editError}</p>}

            <div className="border-t-2 border-gray-200 pt-4 mt-2 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                size="lg"
                className={`flex-1 border-4 font-black ${car?.sold ? "bg-green-600 border-green-600 text-white" : "bg-gray-500 border-gray-500 text-white"}`}
                disabled={isUpdating}
                onClick={() => { setDialogOpen(false); handleToggleSold(); }}
              >
                <Tag className="w-5 h-5 mr-2 flex-shrink-0" />
                {car?.sold ? "MARK ACTIVE" : "MARK SOLD"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="flex-1 border-destructive text-white"
                onClick={() => { setDialogOpen(false); handleDelete(); }}
              >
                <Trash2 className="w-5 h-5 mr-2" /> DELETE VEHICLE
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>CANCEL</Button>
              <Button type="button" size="lg" disabled={isUpdating} onClick={handleEditSave}>
                {isUpdating ? "SAVING..." : "SAVE CHANGES"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Abuse Dialog */}
      <Dialog open={abuseOpen} onOpenChange={v => { if (!abuseSubmitting) setAbuseOpen(v); }}>
        <DialogContent className="bg-white text-black border-2 border-black">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Report Abuse
            </DialogTitle>
          </DialogHeader>
          {abuseDone ? (
            <div className="py-4 text-center space-y-2">
              <p className="font-black text-green-700 text-lg uppercase">Report Submitted</p>
              <p className="text-sm text-gray-600">An administrator has been notified and will review the situation.</p>
              <Button type="button" className="mt-4 font-black uppercase" onClick={() => setAbuseOpen(false)}>Close</Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                Your report will be sent directly to an administrator. Optionally describe what happened:
              </p>
              <Textarea
                placeholder="Describe the issue (optional)"
                value={abuseReason}
                onChange={e => setAbuseReason(e.target.value)}
                className="border-2 border-black font-mono text-sm"
                rows={4}
              />
              {abuseError && <p className="text-red-600 text-xs font-bold">{abuseError}</p>}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-2 border-black font-black uppercase text-xs"
                  onClick={() => setAbuseOpen(false)}
                  disabled={abuseSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-red-600 text-white font-black uppercase text-xs"
                  onClick={handleReportAbuse}
                  disabled={abuseSubmitting}
                >
                  {abuseSubmitting ? "Sending…" : "Submit Report"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
