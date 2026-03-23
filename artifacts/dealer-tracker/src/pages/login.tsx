import { useState } from "react";
import { Wrench, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password.trim()) { setError("Enter the shop password."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        localStorage.setItem("dt_auth", "1");
        onLogin();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Incorrect password.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="bg-black text-white p-4 rounded-2xl shadow-brutal">
              <Wrench className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight">Maintenance Tracker</h1>
          <p className="text-gray-500 font-medium">Enter the shop password to continue.</p>
        </div>

        <div className="bg-white border-4 border-black rounded-2xl p-8 shadow-brutal space-y-6">
          <div className="space-y-2">
            <label className="text-lg font-black uppercase flex items-center gap-2">
              <Lock className="w-5 h-5" /> Shop Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={handleKey}
              placeholder="Enter password"
              className="bg-white text-black text-lg h-14 border-2 border-black"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <Button
            type="button"
            size="lg"
            className="w-full h-14 text-lg"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? "CHECKING..." : "ENTER"}
          </Button>
        </div>
      </div>
    </div>
  );
}
