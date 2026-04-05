import { useState } from "react";
import { Wrench, Lock, User, ChevronRight, ShieldCheck, Car, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Mode = "login" | "register";

export default function LoginPage({
  onLogin,
  onAdminAccess,
}: {
  onLogin: (mechanicId: number, username: string, displayName: string, isAdmin: boolean, role?: string, token?: string) => void;
  onAdminAccess: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"mechanic" | "driver">("mechanic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const reset = () => {
    setError("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setRole("mechanic");
  };

  const switchMode = (m: Mode) => {
    reset();
    setMode(m);
  };

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
      const data = await res.json().catch(() => ({})) as { ok?: boolean; mechanicId?: number; username?: string; displayName?: string; isAdmin?: boolean; role?: string; token?: string; error?: string };
      if (res.ok && data.mechanicId) {
        if (data.isAdmin) {
          setError("Admin accounts must sign in using the admin portal.");
          return;
        }
        onLogin(data.mechanicId, data.username!, data.displayName!, false, data.role, data.token);
      } else {
        setError(data.error || "Incorrect username or password.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim()) { setError("Enter a username."); return; }
    if (!displayName.trim()) { setError("Enter your name."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, displayName: displayName.trim(), role }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; mechanicId?: number; username?: string; displayName?: string; isAdmin?: boolean; role?: string; token?: string; error?: string };
      if (res.ok && data.mechanicId) {
        onLogin(data.mechanicId, data.username!, data.displayName!, data.isAdmin ?? false, data.role, data.token);
      } else {
        setError(data.error || "Could not create account.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") mode === "login" ? handleLogin() : handleRegister();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center items-center gap-4">
            <div className="bg-black text-white p-4 rounded-2xl shadow-brutal">
              <Wrench className="w-12 h-12" />
            </div>
            <button
              type="button"
              onClick={onAdminAccess}
              title="Admin access"
              className="bg-amber-500 text-white p-4 rounded-2xl shadow-brutal hover:bg-amber-600 transition-colors"
            >
              <ShieldCheck className="w-12 h-12" />
            </button>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight">Maintenance Tracker</h1>
          <p className="text-gray-500 font-medium">
            {mode === "login" ? "Sign in to your account." : "Create a new account."}
          </p>
        </div>

        <div className="bg-white border-4 border-black rounded-2xl p-8 shadow-brutal space-y-5">
          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <User className="w-4 h-4" /> Your Name
              </label>
              <Input
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setError(""); }}
                onKeyDown={handleKey}
                placeholder="e.g. Mike Johnson"
                className="bg-white text-black text-lg h-12 border-2 border-black"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-base font-black uppercase flex items-center gap-2">
              <User className="w-4 h-4" /> Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              onKeyDown={handleKey}
              placeholder="e.g. mikej"
              className="bg-white text-black text-lg h-12 border-2 border-black"
              autoFocus
              autoCapitalize="none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-base font-black uppercase flex items-center gap-2">
              <Lock className="w-4 h-4" /> Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={handleKey}
                placeholder={mode === "register" ? "Choose a password (4+ chars)" : "Your password"}
                className="bg-white text-black text-lg h-12 border-2 border-black pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-base font-black uppercase flex items-center gap-2">
                <Lock className="w-4 h-4" /> Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                  onKeyDown={handleKey}
                  placeholder="Re-enter your password"
                  className="bg-white text-black text-lg h-12 border-2 border-black pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-base font-black uppercase block">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("mechanic")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-4 font-black uppercase transition-colors ${
                    role === "mechanic"
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-black"
                  }`}
                >
                  <Wrench className="w-8 h-8" />
                  <span className="text-sm">Mechanic</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("driver")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-4 font-black uppercase transition-colors ${
                    role === "driver"
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-gray-300 bg-white text-black"
                  }`}
                >
                  <Car className="w-8 h-8" />
                  <span className="text-sm">Driver</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {role === "driver"
                  ? "Drivers see simplified pre/during/post-drive checklists."
                  : "Mechanics see the full technical inspection checklist."}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <Button
            type="button"
            size="lg"
            className="w-full h-12 text-base"
            disabled={loading}
            onClick={mode === "login" ? handleLogin : handleRegister}
          >
            {loading ? "PLEASE WAIT..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </Button>

          <div className="text-center pt-2">
            {mode === "login" ? (
              <button
                type="button"
                className="text-sm font-bold underline text-gray-600 flex items-center gap-1 mx-auto"
                onClick={() => switchMode("register")}
              >
                New here? Create an account <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                className="text-sm font-bold underline text-gray-600 flex items-center gap-1 mx-auto"
                onClick={() => switchMode("login")}
              >
                Already have an account? Sign in <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
