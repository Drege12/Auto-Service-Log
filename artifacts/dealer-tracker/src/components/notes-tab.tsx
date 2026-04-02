import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StickyNote, Trash2, Plus } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    const s = raw ? JSON.parse(raw) as { mechanicId: number } : null;
    return { "Content-Type": "application/json", "X-Mechanic-Id": String(s?.mechanicId ?? "") };
  } catch { return { "Content-Type": "application/json", "X-Mechanic-Id": "" }; }
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

type NoteEntry = {
  id: number;
  body: string;
  authorName: string | null;
  createdAt: string;
};

type Props = {
  carId: number;
  initialNotes?: string | null;
};

export function NotesTab({ carId }: Props) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/cars/${carId}/notes-log`, { headers: authHeaders() });
      if (r.ok) setNotes(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void fetchNotes(); }, [carId]);

  const handleAdd = async () => {
    if (!newBody.trim() || adding) return;
    setAdding(true);
    setError("");
    try {
      const r = await fetch(`${BASE}/api/cars/${carId}/notes-log`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ body: newBody.trim() }),
      });
      if (r.ok) {
        const entry: NoteEntry = await r.json();
        setNotes(prev => [...prev, entry]);
        setNewBody("");
      } else {
        const d = await r.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? "Failed to add note.");
      }
    } catch {
      setError("Could not reach the server.");
    }
    setAdding(false);
  };

  const handleDelete = async (noteId: number) => {
    setDeleting(true);
    try {
      await fetch(`${BASE}/api/cars/${carId}/notes-log/${noteId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch { /* ignore */ }
    setDeleting(false);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <StickyNote className="w-7 h-7 text-amber-600" />
        <h2 className="text-2xl font-black uppercase">Vehicle Notes</h2>
      </div>

      {/* Add new note */}
      <div className="border-4 border-black rounded-2xl p-4 bg-amber-50 space-y-3">
        <p className="text-sm font-black uppercase text-amber-800">Add a Note</p>
        <textarea
          value={newBody}
          onChange={e => { setNewBody(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); void handleAdd(); } }}
          placeholder="Quirks, history, reminders, owner preferences…"
          rows={3}
          className="w-full resize-y border-4 border-black rounded-xl p-3 text-base font-medium bg-white text-black focus:outline-none leading-relaxed"
        />
        {error && (
          <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        <Button
          type="button"
          size="lg"
          onClick={handleAdd}
          disabled={!newBody.trim() || adding}
          className="w-full font-black"
        >
          <Plus className="w-5 h-5 mr-2" />
          {adding ? "ADDING…" : "LOG NOTE"}
        </Button>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 font-bold">Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 border-4 border-dashed border-gray-300 rounded-2xl">
          <StickyNote className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-lg font-black text-gray-500 uppercase">No notes yet</p>
          <p className="text-gray-400 font-medium mt-1">Add the first note above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => {
            const isConfirming = confirmDeleteId === note.id;
            return (
              <div key={note.id} className="bg-white border-4 border-black rounded-2xl overflow-hidden">
                <div className="p-4">
                  <p className="text-base font-medium leading-relaxed whitespace-pre-wrap text-black">
                    {note.body}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t-2 border-black px-4 py-2 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 min-w-0">
                    {note.authorName && (
                      <span className="font-black text-black mr-2">{note.authorName}</span>
                    )}
                    {formatDateTime(note.createdAt)}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {isConfirming ? (
                      <>
                        <span className="text-xs font-black text-red-600 uppercase">Delete?</span>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => void handleDelete(note.id)}
                          className="bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-lg border-2 border-red-700 uppercase disabled:opacity-50"
                        >
                          {deleting ? "…" : "YES"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="bg-white text-black font-black text-xs px-3 py-1.5 rounded-lg border-2 border-black uppercase"
                        >
                          NO
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(note.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
