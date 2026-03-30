import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { UserPlus, Pencil, Trash2, Check, X, KeyRound, ShieldCheck, Shield, Phone, Mail, Eye, EyeOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Mechanic = {
  id: number;
  username: string;
  displayName: string;
  isAdmin: number;
  phone?: string | null;
  email?: string | null;
  contactPublic?: number;
  createdAt: string;
};

function getSession() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    return JSON.parse(raw) as { mechanicId: number; username: string; displayName: string; isAdmin: boolean };
  } catch { return null; }
}

function headers() {
  const s = getSession();
  return { "Content-Type": "application/json", "X-Mechanic-Id": String(s?.mechanicId ?? "") };
}

// ---------------------------------------------------------------------------
// Inline edit row
// ---------------------------------------------------------------------------
function EditRow({
  mechanic,
  selfId,
  onSaved,
  onCancel,
}: {
  mechanic: Mechanic;
  selfId: number;
  onSaved: (updated: Mechanic) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(mechanic.displayName);
  const [newPassword, setNewPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(mechanic.isAdmin === 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!displayName.trim()) { setError("Name cannot be empty."); return; }
    if (newPassword && newPassword.length < 4) { setError("Password must be at least 4 characters."); return; }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { displayName: displayName.trim(), isAdmin };
      if (newPassword) body.password = newPassword;
      const res = await fetch(`${BASE}/api/admin/mechanics/${mechanic.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json() as Mechanic & { error?: string };
      if (!res.ok) { setError(data.error || "Save failed."); return; }
      onSaved(data);
    } catch {
      setError("Could not reach server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-amber-50 border-4 border-amber-500 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="bg-secondary text-secondary-foreground font-black px-3 py-1 rounded text-lg tracking-wider">@{mechanic.username}</span>
        <span className="text-sm text-muted-foreground font-bold">Editing account</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-black uppercase block">Display Name</label>
          <Input
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setError(""); }}
            className="bg-white text-black"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-black uppercase block flex items-center gap-1">
            <KeyRound className="w-3 h-3" /> New Password (optional)
          </label>
          <Input
            type="password"
            value={newPassword}
            placeholder="Leave blank to keep current"
            onChange={e => { setNewPassword(e.target.value); setError(""); }}
            className="bg-white text-black"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { if (mechanic.id === selfId && isAdmin) return; setIsAdmin(v => !v); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-black text-sm uppercase transition-colors ${isAdmin ? "bg-amber-500 text-white border-amber-500" : "bg-white text-black border-gray-400"}`}
          title={mechanic.id === selfId ? "Cannot change your own admin status" : ""}
        >
          {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          {isAdmin ? "Admin" : "Mechanic"}
        </button>
        {mechanic.id === selfId && (
          <span className="text-xs text-muted-foreground font-bold">(Cannot change your own role)</span>
        )}
      </div>

      {error && (
        <p className="text-destructive font-bold text-sm">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="button" onClick={save} disabled={saving} className="font-black uppercase">
          <Check className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="font-black uppercase">
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirm
// ---------------------------------------------------------------------------
function DeleteConfirm({ mechanic, onConfirm, onCancel, deleting }: { mechanic: Mechanic; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <div className="bg-red-50 border-4 border-red-500 rounded-2xl p-5 space-y-3">
      <p className="font-black text-lg text-red-700">Delete <span className="underline">{mechanic.displayName}</span> (@{mechanic.username})?</p>
      <p className="text-sm font-bold text-red-600">This removes the account. Their vehicles will remain in the database unassigned.</p>
      <div className="flex gap-3">
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting} className="font-black uppercase">
          {deleting ? "Deleting..." : "Yes, Delete"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={deleting} className="font-black uppercase">Cancel</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------
function CreateForm({ onCreated }: { onCreated: (m: Mechanic) => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setUsername(""); setDisplayName(""); setPassword(""); setIsAdmin(false); setError(""); };

  const create = async () => {
    if (!username.trim()) { setError("Username is required."); return; }
    if (!displayName.trim()) { setError("Display name is required."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/admin/mechanics`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ username: username.trim(), displayName: displayName.trim(), password, isAdmin }),
      });
      const data = await res.json() as Mechanic & { error?: string };
      if (!res.ok) { setError(data.error || "Failed to create."); return; }
      onCreated(data);
      reset();
      setOpen(false);
    } catch {
      setError("Could not reach server.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} size="lg" className="font-black uppercase text-xl px-6 py-3">
        <UserPlus className="w-6 h-6 mr-2" /> Add Account
      </Button>
    );
  }

  return (
    <div className="bg-white border-4 border-black rounded-2xl p-6 space-y-5">
      <h2 className="text-2xl font-black uppercase">New Account</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-black uppercase block">Username</label>
          <Input
            value={username}
            onChange={e => { setUsername(e.target.value); setError(""); }}
            placeholder="e.g. mikej"
            autoCapitalize="none"
            className="bg-white text-black"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-black uppercase block">Display Name</label>
          <Input
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setError(""); }}
            placeholder="e.g. Mike Johnson"
            className="bg-white text-black"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-black uppercase block">Password</label>
        <Input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(""); }}
          placeholder="At least 4 characters"
          className="bg-white text-black"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsAdmin(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-black text-sm uppercase transition-colors ${isAdmin ? "bg-amber-500 text-white border-amber-500" : "bg-white text-black border-gray-400"}`}
        >
          {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          {isAdmin ? "Admin" : "Mechanic"}
        </button>
        <span className="text-xs text-muted-foreground font-bold">Toggle to grant admin access</span>
      </div>

      {error && <p className="text-destructive font-bold text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" onClick={create} disabled={saving} className="font-black uppercase">
          {saving ? "Creating..." : "Create Account"}
        </Button>
        <Button type="button" variant="outline" onClick={() => { reset(); setOpen(false); }} disabled={saving} className="font-black uppercase">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main admin page
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const [, navigate] = useLocation();
  const session = getSession();

  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const fetchMechanics = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${BASE}/api/admin/mechanics`, { headers: headers() });
      if (!res.ok) { setLoadError("Failed to load accounts."); return; }
      const data = await res.json() as Mechanic[];
      setMechanics(data);
    } catch {
      setLoadError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.isAdmin) { navigate("/"); return; }
    fetchMechanics();
  }, []);

  const handleSaved = (updated: Mechanic) => {
    setMechanics(prev => prev.map(m => m.id === updated.id ? updated : m));
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    setDeleteInProgress(true);
    setGlobalError("");
    try {
      const res = await fetch(`${BASE}/api/admin/mechanics/${id}`, { method: "DELETE", headers: headers() });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setGlobalError(data.error || "Delete failed."); return; }
      setMechanics(prev => prev.filter(m => m.id !== id));
      setDeletingId(null);
    } catch {
      setGlobalError("Could not reach server.");
    } finally {
      setDeleteInProgress(false);
    }
  };

  if (!session?.isAdmin) return null;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase">User Accounts</h1>
          <p className="text-muted-foreground font-bold mt-1">Manage all mechanic accounts</p>
        </div>
        <CreateForm onCreated={m => setMechanics(prev => [...prev, m])} />
      </div>

      {globalError && (
        <div className="bg-red-100 border-4 border-red-500 rounded-2xl px-5 py-3 mb-6 font-bold text-red-700">{globalError}</div>
      )}

      {loading && <p className="text-xl font-bold text-center py-12 text-muted-foreground">Loading accounts...</p>}
      {loadError && <p className="text-xl font-bold text-center py-12 text-destructive">{loadError}</p>}

      {!loading && !loadError && (
        <div className="space-y-4">
          {mechanics.map(mechanic => {
            if (editingId === mechanic.id) {
              return (
                <EditRow
                  key={mechanic.id}
                  mechanic={mechanic}
                  selfId={session.mechanicId}
                  onSaved={handleSaved}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            if (deletingId === mechanic.id) {
              return (
                <DeleteConfirm
                  key={mechanic.id}
                  mechanic={mechanic}
                  deleting={deleteInProgress}
                  onConfirm={() => handleDelete(mechanic.id)}
                  onCancel={() => setDeletingId(null)}
                />
              );
            }

            const isSelf = mechanic.id === session.mechanicId;

            return (
              <div key={mechanic.id} className="bg-card border-4 border-black rounded-2xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="bg-secondary text-secondary-foreground font-black px-3 py-1 rounded text-lg tracking-wider">
                        @{mechanic.username}
                      </span>
                      {mechanic.isAdmin === 1 && (
                        <span className="bg-amber-500 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-widest flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </span>
                      )}
                      {isSelf && (
                        <span className="bg-blue-600 text-white font-black px-2 py-1 rounded text-xs uppercase tracking-widest">You</span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black uppercase leading-tight">{mechanic.displayName}</h2>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {mechanic.phone && (
                        <span className="flex items-center gap-1 text-sm font-bold text-gray-700">
                          <Phone className="w-3 h-3" /> {mechanic.phone}
                        </span>
                      )}
                      {mechanic.email && (
                        <span className="flex items-center gap-1 text-sm font-bold text-gray-700">
                          <Mail className="w-3 h-3" /> {mechanic.email}
                        </span>
                      )}
                      {(mechanic.phone || mechanic.email) && (
                        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${mechanic.contactPublic ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                          {mechanic.contactPublic ? <><Eye className="w-3 h-3" /> Public</> : <><EyeOff className="w-3 h-3" /> Private</>}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-bold">
                      Created {new Date(mechanic.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setEditingId(mechanic.id); setDeletingId(null); }}
                      className="font-black uppercase border-2 border-black"
                    >
                      <Pencil className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    {!isSelf && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => { setDeletingId(mechanic.id); setEditingId(null); setGlobalError(""); }}
                        className="font-black uppercase"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {mechanics.length === 0 && (
            <p className="text-center text-xl font-bold text-muted-foreground py-12">No accounts found.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
