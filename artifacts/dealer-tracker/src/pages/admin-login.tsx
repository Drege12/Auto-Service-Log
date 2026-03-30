import { useState } from "react";
import { ShieldCheck, Lock, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminLoginPage({
  onLogin,
  onBack,
}: {
  onLogin: (mechanicId: number, username: string, displayName: string) => void;
  onBack: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) { setError("Enter your username."); return; }
    if (!password) { setError("Enter your password."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean; mechanicId?: number; username?: string;
        displayName?: string; isAdmin?: boolean; error?: string;
      };

      if (!res.ok || !data.mechanicId) {
        setError(data.error || "Incorrect username or password.");
        return;
      }

      if (!data.isAdmin) {
        setError("This account does not have admin access.");
        return;
      }

      onLogin(data.mechanicId, data.username!, data.displayName!);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-brutal">
              <ShieldCheck className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight">Admin Access</h1>
          <p className="text-gray-500 font-medium">Sign in with your admin account.</p>
        </div>

        <div className="bg-white border-4 border-amber-500 rounded-2xl p-8 shadow-brutal space-y-5">
          <div className="space-y-2">
            <label className="text-base font-black uppercase flex items-center gap-2">
              <User className="w-4 h-4" /> Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              onKeyDown={handleKey}
              placeholder="Admin username"
              className="bg-white text-black text-lg h-12 border-2 border-black"
              autoFocus
              autoCapitalize="none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-base font-black uppercase flex items-center gap-2">
              <Lock className="w-4 h-4" /> Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={handleKey}
              placeholder="Admin password"
              className="bg-white text-black text-lg h-12 border-2 border-black"
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
            className="w-full h-12 text-base bg-amber-500 hover:bg-amber-600 text-white font-black border-2 border-amber-600"
            disabled={loading}
            onClick={handleLogin}
          >
            {loading ? "PLEASE WAIT..." : "SIGN IN AS ADMIN"}
          </Button>

          <div className="text-center pt-2">
            <button
              type="button"
              className="text-sm font-bold underline text-gray-600 flex items-center gap-1 mx-auto"
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4" /> Back to mechanic login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
