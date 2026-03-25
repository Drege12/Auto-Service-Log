export type VehicleTypeStr = string | null | undefined;

export interface VinInfo {
  label: string;
  placeholder: string;
  empty: string;
}

export function vinLabel(vehicleType: VehicleTypeStr): VinInfo {
  switch (vehicleType) {
    case "boat":       return { label: "Hull ID (HIN)", placeholder: "e.g. ABC12345D101", empty: "NO HIN RECORDED" };
    case "atv":        return { label: "VIN / Serial #", placeholder: "Serial # (may be shorter than 17 digits)", empty: "NO VIN/SERIAL" };
    case "motorcycle": return { label: "VIN", placeholder: "VIN (vintage bikes may be shorter)", empty: "NO VIN RECORDED" };
    default:           return { label: "VIN", placeholder: "17-character VIN", empty: "NO VIN RECORDED" };
  }
}

export interface MileageInfo {
  label: string;
  unit: string;
  fieldLabel: string;
  placeholder: string;
  empty: string;
  logTitle: string;
  subtitle: string;
  asAcquiredLabel: string;
  currentLabel: string;
  addedLabel: string;
  formTitle: string;
  emptyMessage: string;
}

export function mileageLabel(vehicleType: VehicleTypeStr): MileageInfo {
  switch (vehicleType) {
    case "boat":
      return {
        label: "Engine Hours",
        unit: "hrs",
        fieldLabel: "Engine Hours *",
        placeholder: "e.g. 350",
        empty: "UNKNOWN HOURS",
        logTitle: "Engine Hours Log",
        subtitle: "Track engine hours and fuel level after each use.",
        asAcquiredLabel: "As Acquired (hrs)",
        currentLabel: "Current (hrs)",
        addedLabel: "Hours Added",
        formTitle: "New Engine Hours Entry",
        emptyMessage: "Add the first engine hours reading to start tracking.",
      };
    case "atv":
      return {
        label: "Mileage / Hours",
        unit: "mi/hrs",
        fieldLabel: "Odometer / Hours *",
        placeholder: "e.g. 1200",
        empty: "UNKNOWN MILEAGE",
        logTitle: "Mileage / Hours Log",
        subtitle: "Track odometer or hour readings and fuel level.",
        asAcquiredLabel: "As Acquired",
        currentLabel: "Current",
        addedLabel: "Added",
        formTitle: "New Reading",
        emptyMessage: "Add the first odometer or hours reading to start tracking.",
      };
    default:
      return {
        label: "Mileage",
        unit: "mi",
        fieldLabel: "Odometer (miles) *",
        placeholder: "e.g. 45000",
        empty: "UNKNOWN MILEAGE",
        logTitle: "Mileage Log",
        subtitle: "Track odometer readings and fuel level after each drive.",
        asAcquiredLabel: "As Acquired (mi)",
        currentLabel: "Current (mi)",
        addedLabel: "Dealer Miles Added",
        formTitle: "New Odometer Reading",
        emptyMessage: "Add the first odometer reading to start tracking dealer miles.",
      };
  }
}
