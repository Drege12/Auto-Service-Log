import { useState, useEffect } from "react";
import { useUpdateCarCosts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Clock, FileText, Save } from "lucide-react";

interface CostsTabProps {
  carId: number;
  repairNotes?: string;
  partsCost?: string;
  laborHours?: string;
}

export function CostsTab({ carId, repairNotes, partsCost, laborHours }: CostsTabProps) {
  const queryClient = useQueryClient();
  const { mutate: updateCosts, isPending } = useUpdateCarCosts();

  const [notes, setNotes] = useState(repairNotes ?? "");
  const [parts, setParts] = useState(partsCost ?? "");
  const [hours, setHours] = useState(laborHours ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotes(repairNotes ?? "");
    setParts(partsCost ?? "");
    setHours(laborHours ?? "");
  }, [repairNotes, partsCost, laborHours]);

  const partsNum = parts.trim() ? parseFloat(parts.trim()) : null;
  const hoursNum = hours.trim() ? parseFloat(hours.trim()) : null;
  const laborRate = 100;
  const laborCost = hoursNum != null ? hoursNum * laborRate : null;
  const totalCost = (partsNum ?? 0) + (laborCost ?? 0);
  const hasTotal = partsNum != null || laborCost != null;

  const handleSave = () => {
    setError("");
    if (parts.trim() && isNaN(parseFloat(parts.trim()))) {
      setError("Parts cost must be a valid number.");
      return;
    }
    if (hours.trim() && isNaN(parseFloat(hours.trim()))) {
      setError("Labor hours must be a valid number.");
      return;
    }
    updateCosts({ carId, data: {
      repairNotes: notes.trim() || null,
      partsCost: partsNum,
      laborHours: hoursNum,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}`] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: () => setError("Failed to save. Please try again."),
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-100 p-6 rounded-xl border-4 border-black shadow-brutal">
        <h2 className="text-2xl font-black uppercase">Cost of Repairs</h2>
        <p className="text-gray-600 font-medium mt-1">Track parts costs, labor hours, and repair notes for this vehicle.</p>
      </div>

      {hasTotal && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {partsNum != null && (
            <div className="border-4 border-black bg-white rounded-xl p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-black font-mono">
                <DollarSign className="w-6 h-6" />
                {partsNum.toFixed(2)}
              </div>
              <div className="text-gray-500 font-bold uppercase text-sm mt-1">Parts Cost</div>
            </div>
          )}
          {laborCost != null && (
            <div className="border-4 border-black bg-white rounded-xl p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-black font-mono">
                <Clock className="w-6 h-6" />
                {hoursNum} hrs
              </div>
              <div className="text-gray-500 font-bold uppercase text-sm mt-1">Labor Hours</div>
            </div>
          )}
          {hasTotal && (
            <div className="border-4 border-black bg-black text-white rounded-xl p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-black font-mono">
                <DollarSign className="w-6 h-6" />
                {totalCost.toFixed(2)}
              </div>
              <div className="text-gray-300 font-bold uppercase text-sm mt-1">Est. Total</div>
            </div>
          )}
        </div>
      )}

      <div className="border-4 border-black rounded-xl p-6 bg-white space-y-6">
        {error && (
          <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-lg font-black uppercase flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cost of Parts
            </label>
            <Input
              value={parts}
              onChange={e => setParts(e.target.value)}
              placeholder="e.g. 245.00"
              inputMode="decimal"
              className="bg-white text-black font-mono text-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-lg font-black uppercase flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Estimated Labor Hours
            </label>
            <Input
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="e.g. 3.5"
              inputMode="decimal"
              className="bg-white text-black font-mono text-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-lg font-black uppercase flex items-center gap-2">
            <FileText className="w-5 h-5" />
            General Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe the repairs needed or completed, parts ordered, observations, etc."
            rows={5}
            className="w-full border-2 border-black rounded-lg px-4 py-3 text-base font-medium bg-white text-black focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isPending}
          onClick={handleSave}
        >
          <Save className="w-5 h-5 mr-2" />
          {isPending ? "SAVING..." : saved ? "SAVED!" : "SAVE CHANGES"}
        </Button>
      </div>
    </div>
  );
}
