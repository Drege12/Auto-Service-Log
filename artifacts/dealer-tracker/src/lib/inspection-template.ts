import { UpsertInspectionItemStatus } from "@workspace/api-client-react";

export const INSPECTION_CATEGORIES = [
  "Engine",
  "Transmission",
  "Brakes",
  "Tires",
  "Exterior",
  "Interior",
  "Electrical",
  "Fluids"
];

export const INSPECTION_TEMPLATE = [
  // Engine
  { category: "Engine", item: "Oil level" },
  { category: "Engine", item: "Coolant level" },
  { category: "Engine", item: "Air filter" },
  { category: "Engine", item: "Belts and hoses" },
  { category: "Engine", item: "Engine mounts" },
  { category: "Engine", item: "Valve cover/gaskets" },
  // Transmission
  { category: "Transmission", item: "Fluid level" },
  { category: "Transmission", item: "Shift quality" },
  { category: "Transmission", item: "Linkage" },
  // Brakes
  { category: "Brakes", item: "Front pads thickness" },
  { category: "Brakes", item: "Rear pads thickness" },
  { category: "Brakes", item: "Rotors condition" },
  { category: "Brakes", item: "Brake fluid" },
  { category: "Brakes", item: "Parking brake" },
  { category: "Brakes", item: "Brake lines" },
  // Tires
  { category: "Tires", item: "Front left tread" },
  { category: "Tires", item: "Front right tread" },
  { category: "Tires", item: "Rear left tread" },
  { category: "Tires", item: "Rear right tread" },
  { category: "Tires", item: "Spare tire" },
  { category: "Tires", item: "Tire pressure" },
  // Exterior
  { category: "Exterior", item: "Paint condition" },
  { category: "Exterior", item: "Windshield" },
  { category: "Exterior", item: "Lights (headlights/taillights/signals)" },
  { category: "Exterior", item: "Wipers" },
  { category: "Exterior", item: "Body damage" },
  { category: "Exterior", item: "Door seals" },
  // Interior
  { category: "Interior", item: "Seat condition" },
  { category: "Interior", item: "Dashboard lights" },
  { category: "Interior", item: "A/C and heat" },
  { category: "Interior", item: "Radio/infotainment" },
  { category: "Interior", item: "Windows" },
  { category: "Interior", item: "Seatbelts" },
  // Electrical
  { category: "Electrical", item: "Battery condition" },
  { category: "Electrical", item: "Alternator output" },
  { category: "Electrical", item: "Fuses" },
  { category: "Electrical", item: "Horn" },
  // Fluids
  { category: "Fluids", item: "Power steering fluid" },
  { category: "Fluids", item: "Windshield washer fluid" },
  { category: "Fluids", item: "Differential fluid" },
];

export function buildDefaultInspection() {
  return INSPECTION_TEMPLATE.map(t => ({
    ...t,
    status: UpsertInspectionItemStatus.pending,
    notes: ""
  }));
}
