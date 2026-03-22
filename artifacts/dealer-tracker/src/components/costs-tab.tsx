import { useState, useEffect, useRef } from "react";
import { useUpdateCarCosts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Clock, FileText, Save, TrendingUp, TrendingDown, Minus, Printer } from "lucide-react";
import { printSection } from "@/lib/print-utils";

interface CostsTabProps {
  carId: number;
  carLabel: string;
  repairNotes?: string;
  partsCost?: string;
  laborHours?: string;
  laborRate?: string;
  actualRepairNotes?: string;
  actualPartsCost?: string;
  actualLaborHours?: string;
}

function toNum(v?: string) {
  if (!v || !v.trim()) return null;
  const n = parseFloat(v.trim());
  return isNaN(n) ? null : n;
}

function StatCard({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`border-4 rounded-xl p-4 text-center ${dark ? "border-black bg-black text-white" : "border-black bg-white"}`}>
      <div className={`text-xl font-black font-mono ${dark ? "text-white" : "text-black"}`}>{value}</div>
      <div className={`font-bold uppercase text-xs mt-1 ${dark ? "text-gray-300" : "text-gray-500"}`}>{label}</div>
    </div>
  );
}

export function CostsTab({
  carId, carLabel,
  repairNotes, partsCost, laborHours, laborRate,
  actualRepairNotes, actualPartsCost, actualLaborHours,
}: CostsTabProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { mutate: updateCosts, isPending } = useUpdateCarCosts();

  const [projNotes, setProjNotes] = useState(repairNotes ?? "");
  const [projParts, setProjParts] = useState(partsCost ?? "");
  const [projHours, setProjHours] = useState(laborHours ?? "");
  const [rate, setRate] = useState(laborRate ?? "");

  const [actNotes, setActNotes] = useState(actualRepairNotes ?? "");
  const [actParts, setActParts] = useState(actualPartsCost ?? "");
  const [actHours, setActHours] = useState(actualLaborHours ?? "");

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProjNotes(repairNotes ?? "");
    setProjParts(partsCost ?? "");
    setProjHours(laborHours ?? "");
    setRate(laborRate ?? "");
    setActNotes(actualRepairNotes ?? "");
    setActParts(actualPartsCost ?? "");
    setActHours(actualLaborHours ?? "");
  }, [repairNotes, partsCost, laborHours, laborRate, actualRepairNotes, actualPartsCost, actualLaborHours]);

  const projPartsNum = toNum(projParts);
  const projHoursNum = toNum(projHours);
  const rateNum = toNum(rate) ?? 100;
  const actPartsNum = toNum(actParts);
  const actHoursNum = toNum(actHours);

  const projTotal = (projPartsNum ?? 0) + (projHoursNum ?? 0) * rateNum;
  const actTotal = (actPartsNum ?? 0) + (actHoursNum ?? 0) * rateNum;
  const hasProjData = projPartsNum != null || projHoursNum != null;
  const hasActData = actPartsNum != null || actHoursNum != null;
  const hasBoth = hasProjData && hasActData;
  const variance = actTotal - projTotal;

  const validateNum = (label: string, val: string): string | null => {
    if (val.trim() && isNaN(parseFloat(val.trim()))) return `${label} must be a valid number.`;
    return null;
  };

  const handleSave = () => {
    setError("");
    const e =
      validateNum("Labor rate", rate) ||
      validateNum("Projected parts cost", projParts) ||
      validateNum("Projected labor hours", projHours) ||
      validateNum("Actual parts cost", actParts) ||
      validateNum("Actual labor hours", actHours);
    if (e) { setError(e); return; }

    updateCosts({ carId, data: {
      repairNotes: projNotes.trim() || null,
      partsCost: projPartsNum,
      laborHours: projHoursNum,
      laborRate: toNum(rate),
      actualRepairNotes: actNotes.trim() || null,
      actualPartsCost: actPartsNum,
      actualLaborHours: actHoursNum,
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
    <div ref={contentRef} className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-100 p-6 rounded-xl border-4 border-black shadow-brutal">
        <div>
          <h2 className="text-2xl font-black uppercase">Cost of Repairs</h2>
          <p className="text-gray-600 font-medium mt-1">Compare projected estimates against actual money and time spent.</p>
        </div>
        <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => contentRef.current && printSection(`${carLabel} — Costs`, contentRef.current)}>
          <Printer className="w-5 h-5 mr-2" /> PRINT
        </Button>
      </div>

      {(hasProjData || hasActData) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Projected Total" value={`$${projTotal.toFixed(2)}`} />
          <StatCard label="Actual Total" value={`$${actTotal.toFixed(2)}`} />
          {hasBoth && (
            <div className={`border-4 rounded-xl p-4 text-center col-span-2 ${variance > 0 ? "border-red-500 bg-red-50" : variance < 0 ? "border-green-600 bg-green-50" : "border-gray-400 bg-gray-50"}`}>
              <div className={`flex items-center justify-center gap-2 text-xl font-black font-mono ${variance > 0 ? "text-red-600" : variance < 0 ? "text-green-700" : "text-gray-500"}`}>
                {variance > 0 ? <TrendingUp className="w-5 h-5" /> : variance < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                {variance > 0 ? "+" : ""}{`$${variance.toFixed(2)}`}
              </div>
              <div className="font-bold uppercase text-xs mt-1 text-gray-500">
                {variance > 0 ? "Over Budget" : variance < 0 ? "Under Budget" : "On Budget"}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-4 border-black rounded-xl overflow-hidden">
        <div className="bg-gray-100 border-b-4 border-black px-6 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 font-black uppercase text-base">
            <DollarSign className="w-4 h-4" /> Labor Rate ($/hr)
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-500">$</span>
            <Input
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder="e.g. 125"
              inputMode="decimal"
              className="bg-white text-black font-mono w-32"
            />
            <span className="text-sm text-gray-500 font-medium">/ hr</span>
          </div>
          {rate.trim() && toNum(rate) != null && (
            <span className="text-sm text-gray-500 font-medium">
              Using <span className="font-black text-black">${toNum(rate)!.toFixed(2)}/hr</span> for both totals
            </span>
          )}
          {!rate.trim() && (
            <span className="text-sm text-gray-400 font-medium italic">Defaults to $100/hr if left blank</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projected */}
        <div className="border-4 border-black rounded-xl overflow-hidden">
          <div className="bg-gray-100 border-b-4 border-black px-6 py-4">
            <h3 className="text-xl font-black uppercase">Projected / Estimate</h3>
            <p className="text-gray-600 text-sm font-medium mt-0.5">What you expect to spend</p>
          </div>
          <div className="p-6 space-y-5 bg-white">
            <div className="space-y-1">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Parts Cost
              </label>
              <Input
                value={projParts}
                onChange={e => setProjParts(e.target.value)}
                placeholder="e.g. 245.00"
                inputMode="decimal"
                className="bg-white text-black font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <Clock className="w-4 h-4" /> Labor Hours
              </label>
              <Input
                value={projHours}
                onChange={e => setProjHours(e.target.value)}
                placeholder="e.g. 3.5"
                inputMode="decimal"
                className="bg-white text-black font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <FileText className="w-4 h-4" /> Notes
              </label>
              <textarea
                value={projNotes}
                onChange={e => setProjNotes(e.target.value)}
                placeholder="Repairs needed, parts to order, observations…"
                rows={4}
                className="w-full border-2 border-black rounded-lg px-4 py-3 text-base font-medium bg-white text-black focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actual */}
        <div className="border-4 border-black rounded-xl overflow-hidden">
          <div className="bg-black border-b-4 border-black px-6 py-4">
            <h3 className="text-xl font-black uppercase text-white">Historical Costs</h3>
            <p className="text-gray-400 text-sm font-medium mt-0.5">What has already been spent</p>
          </div>
          <div className="p-6 space-y-5 bg-white">
            <div className="space-y-1">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Parts Cost
              </label>
              <Input
                value={actParts}
                onChange={e => setActParts(e.target.value)}
                placeholder="e.g. 189.50"
                inputMode="decimal"
                className="bg-white text-black font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <Clock className="w-4 h-4" /> Labor Hours
              </label>
              <Input
                value={actHours}
                onChange={e => setActHours(e.target.value)}
                placeholder="e.g. 2.0"
                inputMode="decimal"
                className="bg-white text-black font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <FileText className="w-4 h-4" /> Notes
              </label>
              <textarea
                value={actNotes}
                onChange={e => setActNotes(e.target.value)}
                placeholder="Work completed, actual parts used, time logged…"
                rows={4}
                className="w-full border-2 border-black rounded-lg px-4 py-3 text-base font-medium bg-white text-black focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg">{error}</div>}

      <Button type="button" size="lg" disabled={isPending} onClick={handleSave}>
        <Save className="w-5 h-5 mr-2" />
        {isPending ? "SAVING..." : saved ? "SAVED!" : "SAVE CHANGES"}
      </Button>
    </div>
  );
}
