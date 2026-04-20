import { useState, useEffect, useRef } from "react";
import { useUpdateCosts, type QuoteItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Clock, Save, Printer, Plus, Trash2, Package, Wrench } from "lucide-react";
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
  quoteItems?: QuoteItem[] | null;
}

function toNum(v?: string | number | null) {
  if (v == null) return null;
  const s = typeof v === "number" ? String(v) : v.trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function newId() {
  return `qi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type EditableItem = {
  id: string;
  kind: "part" | "labor";
  description: string;
  qty: string;
  unitCost: string;
  hours: string;
};

function toEditable(items: QuoteItem[] | null | undefined): EditableItem[] {
  if (!items || items.length === 0) return [];
  return items.map(i => ({
    id: i.id,
    kind: i.kind as "part" | "labor",
    description: i.description ?? "",
    qty: i.qty != null ? String(i.qty) : "",
    unitCost: i.unitCost != null ? String(i.unitCost) : "",
    hours: i.hours != null ? String(i.hours) : "",
  }));
}

export function CostsTab({
  carId, carLabel,
  laborRate,
  quoteItems,
}: CostsTabProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { mutate: updateCosts, isPending } = useUpdateCosts();

  const [rate, setRate] = useState(laborRate ?? "");
  const [items, setItems] = useState<EditableItem[]>(() => toEditable(quoteItems));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRate(laborRate ?? "");
    setItems(toEditable(quoteItems));
  }, [laborRate, quoteItems]);

  const rateNum = toNum(rate) ?? 100;
  const partsItems = items.filter(i => i.kind === "part");
  const laborItems = items.filter(i => i.kind === "labor");

  const lineTotal = (it: EditableItem): number => {
    if (it.kind === "part") {
      const q = toNum(it.qty) ?? 1;
      const u = toNum(it.unitCost) ?? 0;
      return q * u;
    }
    const h = toNum(it.hours) ?? 0;
    return h * rateNum;
  };

  const partsSubtotal = partsItems.reduce((s, i) => s + lineTotal(i), 0);
  const laborHoursTotal = laborItems.reduce((s, i) => s + (toNum(i.hours) ?? 0), 0);
  const laborSubtotal = laborHoursTotal * rateNum;
  const grandTotal = partsSubtotal + laborSubtotal;

  const addPart = () => setItems(arr => [...arr, { id: newId(), kind: "part", description: "", qty: "1", unitCost: "", hours: "" }]);
  const addLabor = () => setItems(arr => [...arr, { id: newId(), kind: "labor", description: "", qty: "", unitCost: "", hours: "" }]);
  const removeItem = (id: string) => setItems(arr => arr.filter(i => i.id !== id));
  const updateItem = (id: string, patch: Partial<EditableItem>) =>
    setItems(arr => arr.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const handleSave = () => {
    setError("");
    if (rate.trim() && toNum(rate) == null) { setError("Labor rate must be a valid number."); return; }
    for (const it of items) {
      if (it.qty.trim() && toNum(it.qty) == null) { setError("All quantities must be numbers."); return; }
      if (it.unitCost.trim() && toNum(it.unitCost) == null) { setError("All unit costs must be numbers."); return; }
      if (it.hours.trim() && toNum(it.hours) == null) { setError("All hours must be numbers."); return; }
    }

    const payloadItems: QuoteItem[] = items.map(i => ({
      id: i.id,
      kind: i.kind,
      description: i.description.trim(),
      qty: i.kind === "part" ? (toNum(i.qty) ?? null) : null,
      unitCost: i.kind === "part" ? (toNum(i.unitCost) ?? null) : null,
      hours: i.kind === "labor" ? (toNum(i.hours) ?? null) : null,
    }));

    updateCosts({ carId, data: {
      laborRate: toNum(rate) ?? undefined,
      quoteItems: payloadItems,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/cars/${carId}`] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: () => setError("Failed to save. Please try again."),
    });
  };

  const money = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div ref={contentRef} className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-emerald-50 to-green-50 px-5 py-4 rounded-xl border-4 border-black shadow-brutal">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-700 text-white rounded-lg flex items-center justify-center border-2 border-black shadow-brutal-sm">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase leading-tight">Repair Quote</h2>
            <p className="text-gray-700 font-medium text-sm">Itemize parts and labor for an estimate.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="lg" onClick={() => contentRef.current && printSection(`${carLabel} — Quote`, contentRef.current)}>
          <Printer className="w-5 h-5 mr-2" /> PRINT
        </Button>
      </div>

      {/* Labor rate */}
      <div className="border-4 border-black rounded-xl bg-white p-4 sm:p-5 flex flex-wrap items-center gap-3 shadow-brutal-sm">
        <div className="flex items-center gap-2 font-black uppercase text-base">
          <Clock className="w-5 h-5" /> Shop Rate
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-500">$</span>
          <Input
            value={rate}
            onChange={e => setRate(e.target.value)}
            placeholder="100"
            inputMode="decimal"
            className="bg-white text-black font-mono w-28 text-lg"
          />
          <span className="text-sm text-gray-500 font-medium">/ hr</span>
        </div>
        <span className="text-sm text-gray-500 font-medium ml-auto italic">{!rate.trim() ? "Defaults to $100/hr" : `Using $${(toNum(rate) ?? 100).toFixed(2)}/hr for all labor lines`}</span>
      </div>

      {/* PARTS section */}
      <section className="border-4 border-black rounded-xl overflow-hidden shadow-brutal-sm">
        <div className="bg-blue-50 border-b-4 border-black px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-black uppercase text-lg text-blue-900">
            <Package className="w-5 h-5" /> Parts ({partsItems.length})
          </div>
          <button type="button" onClick={addPart} className="flex items-center gap-1.5 bg-blue-600 text-white font-black uppercase text-sm px-3 py-1.5 rounded-lg border-2 border-black hover:bg-blue-700 transition-colors shadow-brutal-sm tap-target">
            <Plus className="w-4 h-4" /> Add Part
          </button>
        </div>
        <div className="bg-white">
          {partsItems.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400 font-medium italic">No parts added yet.</div>
          )}
          {partsItems.map(it => {
            const total = lineTotal(it);
            return (
              <div key={it.id} className="border-b-2 border-gray-200 last:border-b-0 px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-gray-50">
                <Input
                  value={it.description}
                  onChange={e => updateItem(it.id, { description: e.target.value })}
                  placeholder="Part description (e.g. Brake pads — front)"
                  className="bg-white text-black col-span-12 sm:col-span-5 font-medium"
                />
                <div className="col-span-3 sm:col-span-2 flex items-center gap-1">
                  <Input
                    value={it.qty}
                    onChange={e => updateItem(it.id, { qty: e.target.value })}
                    placeholder="Qty"
                    inputMode="decimal"
                    className="bg-white text-black font-mono text-center"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 flex items-center gap-1">
                  <span className="text-gray-400 font-bold">$</span>
                  <Input
                    value={it.unitCost}
                    onChange={e => updateItem(it.id, { unitCost: e.target.value })}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="bg-white text-black font-mono"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2 text-right font-mono font-black text-base text-blue-900">{money(total)}</div>
                <button type="button" onClick={() => removeItem(it.id)} className="col-span-2 sm:col-span-1 ml-auto text-red-600 hover:text-white hover:bg-red-600 border-2 border-red-300 hover:border-red-600 rounded-lg p-1.5 transition-colors" aria-label="Remove">
                  <Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            );
          })}
          {partsItems.length > 0 && (
            <div className="bg-blue-50 border-t-4 border-black px-5 py-3 flex justify-between items-center">
              <span className="font-black uppercase text-blue-900">Parts Subtotal</span>
              <span className="font-mono font-black text-xl text-blue-900">{money(partsSubtotal)}</span>
            </div>
          )}
        </div>
      </section>

      {/* LABOR section */}
      <section className="border-4 border-black rounded-xl overflow-hidden shadow-brutal-sm">
        <div className="bg-orange-50 border-b-4 border-black px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-black uppercase text-lg text-orange-900">
            <Wrench className="w-5 h-5" /> Labor / Services ({laborItems.length})
          </div>
          <button type="button" onClick={addLabor} className="flex items-center gap-1.5 bg-orange-600 text-white font-black uppercase text-sm px-3 py-1.5 rounded-lg border-2 border-black hover:bg-orange-700 transition-colors shadow-brutal-sm tap-target">
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>
        <div className="bg-white">
          {laborItems.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400 font-medium italic">No labor lines added yet.</div>
          )}
          {laborItems.map(it => {
            const total = lineTotal(it);
            return (
              <div key={it.id} className="border-b-2 border-gray-200 last:border-b-0 px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-gray-50">
                <Input
                  value={it.description}
                  onChange={e => updateItem(it.id, { description: e.target.value })}
                  placeholder="Service description (e.g. Replace front brake pads)"
                  className="bg-white text-black col-span-12 sm:col-span-6 font-medium"
                />
                <div className="col-span-4 sm:col-span-2 flex items-center gap-1">
                  <Input
                    value={it.hours}
                    onChange={e => updateItem(it.id, { hours: e.target.value })}
                    placeholder="Hrs"
                    inputMode="decimal"
                    className="bg-white text-black font-mono text-center"
                  />
                  <span className="text-xs text-gray-500 font-bold">hr</span>
                </div>
                <div className="col-span-3 sm:col-span-2 text-center text-xs font-bold text-gray-500">
                  × ${rateNum.toFixed(2)}
                </div>
                <div className="col-span-3 sm:col-span-1 text-right font-mono font-black text-base text-orange-900">{money(total)}</div>
                <button type="button" onClick={() => removeItem(it.id)} className="col-span-2 sm:col-span-1 ml-auto text-red-600 hover:text-white hover:bg-red-600 border-2 border-red-300 hover:border-red-600 rounded-lg p-1.5 transition-colors" aria-label="Remove">
                  <Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            );
          })}
          {laborItems.length > 0 && (
            <div className="bg-orange-50 border-t-4 border-black px-5 py-3 flex justify-between items-center gap-3 flex-wrap">
              <span className="font-black uppercase text-orange-900">Labor Subtotal</span>
              <div className="text-right">
                <div className="text-xs font-bold text-orange-700 uppercase">{laborHoursTotal.toFixed(2)} hrs × ${rateNum.toFixed(2)}/hr</div>
                <div className="font-mono font-black text-xl text-orange-900">{money(laborSubtotal)}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* GRAND TOTAL */}
      {(partsItems.length > 0 || laborItems.length > 0) && (
        <div className="bg-black text-white border-4 border-black rounded-xl px-6 py-5 shadow-brutal flex justify-between items-center">
          <span className="text-xl sm:text-2xl font-black uppercase tracking-tight">Grand Total</span>
          <span className="font-mono font-black text-3xl sm:text-4xl">{money(grandTotal)}</span>
        </div>
      )}

      {error && <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg">{error}</div>}

      <Button type="button" size="lg" disabled={isPending} onClick={handleSave} className="w-full sm:w-auto">
        <Save className="w-5 h-5 mr-2" />
        {isPending ? "SAVING..." : saved ? "SAVED!" : "SAVE QUOTE"}
      </Button>
    </div>
  );
}
