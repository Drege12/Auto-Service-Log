import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChevronRight, ChevronDown } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BadgeRowProps {
  label: string;
  color: string;
  description: string;
}

function BadgeRow({ label, color, description }: BadgeRowProps) {
  return (
    <div className="flex items-start gap-4 py-5 border-b-2 border-gray-200 last:border-0">
      <span className={`shrink-0 font-black px-3 py-1 rounded text-sm uppercase tracking-wide text-white ${color}`}>
        {label}
      </span>
      <p className="text-lg font-sans leading-snug text-black">{description}</p>
    </div>
  );
}

interface SubtypeInfo { value: string; label: string; description: string; image: string }

const CAR_SUBTYPES: SubtypeInfo[] = [
  { value: "sedan",       label: "Sedan",       description: "A standard 4-door car with a separate enclosed trunk. The most common vehicle type.",                                   image: `${BASE}/doc-images/sedan.jpg` },
  { value: "truck",       label: "Truck",       description: "A pickup truck with an open bed behind the cab for hauling cargo or equipment.",                                         image: `${BASE}/doc-images/truck.jpg` },
  { value: "suv",         label: "SUV",         description: "Sport Utility Vehicle. Higher ride height than a regular car with a shared cargo and passenger area in the back.",         image: `${BASE}/doc-images/suv.jpg` },
  { value: "van",         label: "Van",         description: "A tall, boxy vehicle with a large interior — used for passengers (minivan) or cargo (cargo van).",                        image: `${BASE}/doc-images/van.jpg` },
  { value: "coupe",       label: "Coupe",       description: "A 2-door car, typically with a sportier profile and a sloping roofline.",                                                 image: `${BASE}/doc-images/coupe.jpg` },
  { value: "wagon",       label: "Wagon",       description: "Like a sedan but with an extended roofline over the rear — cargo loads directly through a rear hatch instead of a separate trunk.", image: `${BASE}/doc-images/wagon.jpg` },
  { value: "convertible", label: "Convertible", description: "A car with a retractable roof — either a soft cloth top or a hard folding top.",                                         image: `${BASE}/doc-images/convertible.jpg` },
];

const MOTORCYCLE_SUBTYPES: SubtypeInfo[] = [
  { value: "cruiser",   label: "Cruiser",    description: "Low-slung bikes with a relaxed, laid-back riding position and feet forward. Harley-Davidson style.",                         image: `${BASE}/doc-images/cruiser.jpg` },
  { value: "sport",     label: "Sport Bike", description: "Built for performance. Rider leans forward aggressively over the tank. Fast and lightweight.",                               image: `${BASE}/doc-images/sport-bike.jpg` },
  { value: "touring",   label: "Touring",    description: "Large, comfortable bikes designed for long-distance riding. Usually have fairings, built-in luggage, and a more upright seat.", image: `${BASE}/doc-images/touring.jpg` },
  { value: "dualsport", label: "Dual Sport", description: "Street-legal motorcycles that can also handle gravel roads and light off-road use.",                                         image: `${BASE}/doc-images/dualsport.jpg` },
  { value: "standard",  label: "Standard",   description: "An upright, versatile everyday motorcycle. No extreme lean in either direction — comfortable for commuting or general use.",  image: `${BASE}/doc-images/standard-motorcycle.jpg` },
];

const BOAT_SUBTYPES: SubtypeInfo[] = [
  { value: "outboard",   label: "Outboard",         description: "Engine is mounted on the back of the boat outside the hull. The whole motor tilts and steers. Very common on smaller boats.",                                             image: `${BASE}/doc-images/outboard.jpg` },
  { value: "inboard",    label: "Inboard",           description: "Engine is inside the hull and drives a shaft that goes through the bottom of the boat to a fixed propeller underneath. Common on ski boats and larger vessels.",             image: `${BASE}/doc-images/inboard.jpg` },
  { value: "sterndrive", label: "I/O (Sterndrive)",  description: "Inboard/Outboard. Engine is inside the hull but drives an outdrive unit mounted on the transom (rear). Combines the power of an inboard with the steering of an outboard.", image: `${BASE}/doc-images/sterndrive.jpg` },
  { value: "jetboat",    label: "Jet Boat",          description: "Propelled by a jet of water instead of a propeller. No exposed prop under the hull — good for shallow water.",                                                             image: `${BASE}/doc-images/jetboat.jpg` },
  { value: "pwc",        label: "PWC",               description: "Personal Watercraft. Small sit-on-top or stand-on watercraft — commonly known as Jet Ski, Sea-Doo, or WaveRunner.",                                                       image: `${BASE}/doc-images/pwc.jpg` },
  { value: "pontoon",    label: "Pontoon",            description: "A flat-deck boat supported by two or three large aluminum tubes (pontoons) instead of a traditional hull. Stable and spacious — popular for recreational use.",             image: `${BASE}/doc-images/pontoon.jpg` },
  { value: "sailboat",   label: "Sailboat",           description: "Uses wind power through sails as its primary means of propulsion. May also have an auxiliary motor.",                                                                      image: `${BASE}/doc-images/sailboat.jpg` },
];

const ATV_SUBTYPES: SubtypeInfo[] = [
  { value: "quad",         label: "4-Wheeler",      description: "A single-rider four-wheeled off-road vehicle steered with handlebars. Also called a quad or ATV.",                   image: `${BASE}/doc-images/quad.jpg` },
  { value: "side-by-side", label: "Side-by-Side",   description: "A UTV (Utility Task Vehicle) with two or more seats side by side and a steering wheel. Bigger and more capable than a standard ATV.", image: `${BASE}/doc-images/side-by-side.jpg` },
  { value: "dirtbike",     label: "Dirtbike",        description: "A lightweight off-road motorcycle. Not street legal in most areas. Two wheels, handlebars, made for trails and rough terrain.",       image: `${BASE}/doc-images/dirtbike.jpg` },
  { value: "snowmobile",   label: "Snowmobile",      description: "A winter vehicle with skis on the front for steering and a rubber track on the back for propulsion over snow.",                       image: `${BASE}/doc-images/snowmobile.jpg` },
  { value: "3wheeler",     label: "3-Wheeler",       description: "A three-wheeled vehicle — either a traditional trike ATV or a modern three-wheeled motorcycle/roadster.",                             image: `${BASE}/doc-images/3wheeler.jpg` },
];

const VEHICLE_TYPES = [
  {
    value: "car",
    label: "Car / Truck",
    description: "Covers all standard road vehicles: sedans, trucks, SUVs, vans, coupes, wagons, and convertibles.",
    subtypes: CAR_SUBTYPES,
  },
  {
    value: "motorcycle",
    label: "Motorcycle",
    description: "Two-wheeled powered vehicles. Choose the style that best matches your bike.",
    subtypes: MOTORCYCLE_SUBTYPES,
  },
  {
    value: "boat",
    label: "Boat",
    description: "All watercraft. The subtype is based on the engine/drive system, not the shape of the hull.",
    subtypes: BOAT_SUBTYPES,
  },
  {
    value: "atv",
    label: "ATV / UTV",
    description: "Off-road and recreational vehicles that don't fit in the car or motorcycle category.",
    subtypes: ATV_SUBTYPES,
  },
];

const VIN_INFO: {
  value: string;
  label: string;
  idLabel: string;
  locations: string[];
  note?: string;
  image: string;
}[] = [
  {
    value: "car",
    label: "Car / Truck",
    idLabel: "VIN",
    locations: [
      "Driver's side dashboard — look through the windshield at the bottom corner. There's a small metal plate with the number stamped or printed on it.",
      "Driver's door jamb — open the driver's door and look at the sticker on the edge of the door frame. The VIN is printed there along with other info.",
      "Under the hood — sometimes stamped on the firewall or on a sticker near the engine.",
    ],
    note: "All U.S. vehicles from 1981 onward have a standardized 17-character VIN.",
    image: `${BASE}/doc-images/vin-car.png`,
  },
  {
    value: "motorcycle",
    label: "Motorcycle",
    idLabel: "VIN",
    locations: [
      "Steering head — the top of the front fork where it meets the frame. The VIN is typically stamped directly into the metal here.",
      "Frame downtube — some bikes also have it stamped on the main frame tube below the engine.",
      "Sticker on the frame — some manufacturers add a label near the steering head or on the swingarm.",
    ],
    note: "You may need to wipe away grease or dirt to read a stamped VIN clearly.",
    image: `${BASE}/doc-images/vin-motorcycle.png`,
  },
  {
    value: "boat",
    label: "Boat",
    idLabel: "HIN",
    locations: [
      "Transom — the flat back wall of the boat. The HIN is on the upper right corner of the transom (starboard side when looking at the boat from behind).",
      "It's typically a 12-character number stamped on a plate or molded directly into the fiberglass.",
    ],
    note: "Boats use a HIN (Hull Identification Number) instead of a VIN. All boats manufactured after 1972 are required to have one.",
    image: `${BASE}/doc-images/hin-boat.png`,
  },
  {
    value: "atv",
    label: "ATV / UTV",
    idLabel: "VIN",
    locations: [
      "Main frame — typically stamped on one of the main frame tubes near the front axle or under the handlebars.",
      "Neck/steering area — similar to a motorcycle, the steering stem or adjacent frame is a common spot.",
      "Some models have a sticker on the frame or under the seat.",
    ],
    note: "Location varies more by manufacturer for ATVs. If you can't find it, check the owner's manual — it usually has a diagram.",
    image: `${BASE}/doc-images/vin-atv.png`,
  },
];

function VehicleTypesDrillDown() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);

  const typeData = VEHICLE_TYPES.find(t => t.value === selectedType);
  const subtypeData = typeData?.subtypes.find(s => s.value === selectedSubtype);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {VEHICLE_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              if (selectedType === t.value) {
                setSelectedType(null);
                setSelectedSubtype(null);
              } else {
                setSelectedType(t.value);
                setSelectedSubtype(null);
              }
            }}
            className={`font-black uppercase px-5 py-3 rounded-xl border-4 transition-colors text-lg ${
              selectedType === t.value
                ? "bg-black text-white border-black"
                : "bg-white text-black border-black hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {typeData && (
        <div className="border-4 border-black rounded-2xl p-5 bg-gray-50 space-y-4">
          <p className="text-base font-sans text-gray-700">{typeData.description}</p>

          <div className="flex flex-wrap gap-2">
            {typeData.subtypes.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSelectedSubtype(selectedSubtype === s.value ? null : s.value)}
                className={`font-black uppercase px-4 py-2 rounded-lg border-2 transition-colors text-sm flex items-center gap-1.5 ${
                  selectedSubtype === s.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-400 hover:border-black"
                }`}
              >
                {s.label}
                {selectedSubtype === s.value
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {subtypeData && (
            <div className="bg-white border-4 border-black rounded-xl overflow-hidden">
              <img
                src={subtypeData.image}
                alt={subtypeData.label}
                className="w-full object-cover max-h-56"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="px-5 py-4">
                <p className="font-black uppercase text-xl mb-1">{subtypeData.label}</p>
                <p className="text-lg font-sans text-black leading-snug">{subtypeData.description}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VinFinderDrillDown() {
  const [selected, setSelected] = useState<string | null>(null);
  const info = VIN_INFO.find(v => v.value === selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {VIN_INFO.map(v => (
          <button
            key={v.value}
            type="button"
            onClick={() => setSelected(selected === v.value ? null : v.value)}
            className={`font-black uppercase px-5 py-3 rounded-xl border-4 transition-colors text-lg ${
              selected === v.value
                ? "bg-black text-white border-black"
                : "bg-white text-black border-black hover:bg-gray-100"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {info && (
        <div className="border-4 border-black rounded-2xl p-5 bg-gray-50 space-y-4">
          <p className="font-black uppercase text-xl">
            Where to Find Your {info.idLabel} — {info.label}
          </p>

          <img
            src={info.image}
            alt={`${info.idLabel} location on a ${info.label}`}
            className="w-full rounded-xl border-2 border-gray-300 bg-white object-contain max-h-64"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />

          <ul className="space-y-3">
            {info.locations.map((loc, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 bg-black text-white font-black w-7 h-7 rounded-full flex items-center justify-center text-sm mt-0.5">
                  {i + 1}
                </span>
                <p className="text-lg font-sans text-black leading-snug">{loc}</p>
              </li>
            ))}
          </ul>

          {info.note && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-3 text-amber-900 font-sans text-base">
              {info.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Help & Guide</h1>
          <p className="text-lg text-gray-600 font-sans">
            A quick reference for understanding what you see in the app.
          </p>
        </div>

        <div className="border-4 border-black rounded-2xl bg-white px-6 pt-4 pb-2">
          <h2 className="text-2xl font-black uppercase mb-1">Vehicle Status Badges</h2>
          <p className="text-base font-sans text-gray-600 mb-2">
            These colored labels appear on a vehicle's detail page.
          </p>
          <BadgeRow
            label="Ready"
            color="bg-green-600"
            description="No faults that impair drivability."
          />
          <BadgeRow
            label="Service Due"
            color="bg-amber-500"
            description="Routine maintenance is coming up or overdue. No urgent issue, but something needs to be scheduled soon."
          />
          <BadgeRow
            label="Needs Attention"
            color="bg-orange-600"
            description="The vehicle is drivable, but something needs to be addressed — either by you or a technician."
          />
          <BadgeRow
            label="Out of Service"
            color="bg-red-600"
            description="The vehicle is not available for use. It may be unsafe to drive or waiting on a major repair."
          />
        </div>

        <div className="border-4 border-black rounded-2xl bg-white px-6 py-5 space-y-4">
          <div>
            <h2 className="text-2xl font-black uppercase mb-1">Vehicle Types</h2>
            <p className="text-base font-sans text-gray-600">
              When adding a vehicle, select the type that matches, then pick the style that best describes it. Tap a style button to see a description.
            </p>
          </div>
          <VehicleTypesDrillDown />
        </div>

        <div className="border-4 border-black rounded-2xl bg-white px-6 py-5 space-y-4">
          <div>
            <h2 className="text-2xl font-black uppercase mb-1">Finding Your VIN / HIN</h2>
            <p className="text-base font-sans text-gray-600">
              The VIN (or HIN for boats) is a unique number that identifies your vehicle. Select your vehicle type below to see where to find it.
            </p>
          </div>
          <VinFinderDrillDown />
        </div>
      </div>
    </Layout>
  );
}
