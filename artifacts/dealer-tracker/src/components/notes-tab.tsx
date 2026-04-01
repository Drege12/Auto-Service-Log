import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StickyNote, Save, CheckCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    const s = raw ? JSON.parse(raw) as { mechanicId: number } : null;
    return { "Content-Type": "application/json", "X-Mechanic-Id": String(s?.mechanicId ?? "") };
  } catch { return { "Content-Type": "application/json", "X-Mechanic-Id": "" }; }
}

type Props = {
  carId: number;
  initialNotes: string | null | undefined;
};

export function NotesTab({ carId, initialNotes }: Props) {
  const [text, setText] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setText(initialNotes ?? "");
  }, [initialNotes]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch(`${BASE}/api/cars/${carId}/notes`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ notes: text.trim() || null }),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await r.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? "Failed to save notes.");
      }
    } catch {
      setError("Could not reach the server.");
    }
    setSaving(false);
  };

  const isDirty = text !== (initialNotes ?? "");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <StickyNote className="w-7 h-7 text-amber-600" />
        <h2 className="text-2xl font-black uppercase">Vehicle Notes</h2>
      </div>

      <p className="text-gray-500 font-medium text-base">
        Freeform notes about this vehicle — quirks, history, reminders, owner preferences, anything useful.
      </p>

      <textarea
        className="w-full min-h-[260px] resize-y border-4 border-black rounded-xl p-4 text-base font-medium bg-white text-black focus:outline-none focus:ring-2 focus:ring-black leading-relaxed"
        placeholder="Add notes here…"
        value={text}
        onChange={e => { setText(e.target.value); setSaved(false); setError(""); }}
      />

      {error && (
        <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="lg"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? "SAVING…" : "SAVE NOTES"}
        </Button>

        {saved && (
          <span className="flex items-center gap-2 text-green-700 font-black uppercase text-base">
            <CheckCircle className="w-5 h-5" />
            Saved!
          </span>
        )}

        {!isDirty && !saved && text.trim() && (
          <span className="text-gray-400 font-medium text-sm">No unsaved changes</span>
        )}
      </div>
    </div>
  );
}
