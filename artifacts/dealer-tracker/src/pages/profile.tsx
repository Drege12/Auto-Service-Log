import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { Phone, Mail, Eye, EyeOff, User, Hash, Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Profile = {
  id: number;
  username: string;
  displayName: string;
  isAdmin: number;
  role: string;
  phone: string | null;
  email: string | null;
  contactPublic: boolean;
  shopCode: string | null;
};

function getSession() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return null;
    return JSON.parse(raw) as { mechanicId: number; username: string; displayName: string; isAdmin: boolean; role?: string };
  } catch { return null; }
}

function authHeaders() {
  const s = getSession();
  return { "Content-Type": "application/json", "X-Mechanic-Id": String(s?.mechanicId ?? "") };
}

export default function ProfilePage() {
  const session = getSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactPublic, setContactPublic] = useState(false);
  const [shopCode, setShopCode] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/profile`, { headers: authHeaders() })
      .then(r => r.json())
      .then((data: Profile) => {
        setProfile(data);
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setContactPublic(data.contactPublic);
        setShopCode(data.shopCode || "");
        setLoading(false);
      })
      .catch(() => {
        setLoadError("Failed to load profile.");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      const body: Record<string, unknown> = { phone: phone.trim(), email: email.trim(), contactPublic };
      if (profile?.role === "mechanic") body.shopCode = shopCode.trim().toUpperCase();

      const res = await fetch(`${BASE}/api/profile`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json() as Profile & { error?: string };
      if (!res.ok) { setSaveError(data.error || "Save failed."); return; }
      setProfile(data);
      setPhone(data.phone || "");
      setEmail(data.email || "");
      setContactPublic(data.contactPublic);
      setShopCode(data.shopCode || "");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const isMechanic = profile?.role === "mechanic" || session?.role === "mechanic" || (!session?.role && !profile?.role);

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-8">
        <h1 className="text-4xl sm:text-5xl font-black uppercase">My Profile</h1>

        {loading && <p className="text-xl font-bold text-muted-foreground py-12 text-center">Loading...</p>}
        {loadError && <p className="text-xl font-bold text-destructive">{loadError}</p>}

        {profile && !loading && (
          <>
            <div className="bg-white border-4 border-black rounded-2xl p-6 space-y-2">
              <div className="flex items-center gap-3">
                <div className="bg-black text-white p-2 rounded-lg">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-2xl font-black uppercase">{profile.displayName}</p>
                  <p className="font-mono text-lg text-muted-foreground">@{profile.username}</p>
                </div>
                {profile.isAdmin === 1 && (
                  <span className="ml-auto bg-amber-500 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-widest">Admin</span>
                )}
                {profile.isAdmin !== 1 && profile.role !== "driver" && (
                  <span className="ml-auto bg-blue-700 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-widest">Technician</span>
                )}
                {profile.role === "driver" && (
                  <span className="ml-auto bg-teal-600 text-white font-black px-3 py-1 rounded text-sm uppercase tracking-widest">Driver</span>
                )}
              </div>
            </div>

            <div className="bg-white border-4 border-black rounded-2xl p-6 space-y-6">
              <h2 className="text-2xl font-black uppercase">Contact Information</h2>
              <p className="text-base font-bold text-gray-600">
                This information lets others reach you when you are working on a vehicle.
              </p>

              <div className="space-y-1">
                <label className="text-base font-black uppercase flex items-center gap-2 block">
                  <Phone className="w-4 h-4" /> Phone
                </label>
                <PhoneInput
                  value={phone}
                  onChange={val => { setPhone(val); setSaveSuccess(false); }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-base font-black uppercase flex items-center gap-2 block">
                  <Mail className="w-4 h-4" /> Email
                </label>
                <Input
                  value={email}
                  onChange={e => { setEmail(e.target.value); setSaveSuccess(false); }}
                  placeholder="e.g. you@example.com"
                  inputMode="email"
                  className="bg-white text-black text-lg"
                />
              </div>

              {isMechanic && (
                <div className="space-y-1">
                  <label className="text-base font-black uppercase flex items-center gap-2 block">
                    <Hash className="w-4 h-4" /> Shop Code
                  </label>
                  <Input
                    value={shopCode}
                    onChange={e => { setShopCode(e.target.value.toUpperCase()); setSaveSuccess(false); }}
                    placeholder="e.g. MAINST"
                    maxLength={16}
                    className="bg-white text-black text-lg font-mono uppercase"
                  />
                  <p className="text-sm text-gray-500 font-medium mt-1">
                    Mechanics with the same code will appear in each other's default message search.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-base font-black uppercase block">Visibility</label>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => { setContactPublic(true); setSaveSuccess(false); }}
                    className={`flex items-center gap-4 px-5 py-4 rounded-xl border-4 font-black uppercase text-left transition-colors ${
                      contactPublic ? "bg-black text-white border-black" : "bg-white text-black border-black"
                    }`}
                  >
                    <Eye className="w-6 h-6 flex-shrink-0" />
                    <div>
                      <div className="text-lg">Public</div>
                      <div className={`text-sm font-bold ${contactPublic ? "text-gray-300" : "text-gray-500"}`}>
                        Visible to all mechanics on this vehicle
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setContactPublic(false); setSaveSuccess(false); }}
                    className={`flex items-center gap-4 px-5 py-4 rounded-xl border-4 font-black uppercase text-left transition-colors ${
                      !contactPublic ? "bg-black text-white border-black" : "bg-white text-black border-black"
                    }`}
                  >
                    <EyeOff className="w-6 h-6 flex-shrink-0" />
                    <div>
                      <div className="text-lg">Private</div>
                      <div className={`text-sm font-bold ${!contactPublic ? "text-gray-300" : "text-gray-500"}`}>
                        Only visible to you and the admin
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="bg-red-100 border-2 border-red-600 text-red-700 font-bold p-4 rounded-lg">{saveError}</div>
              )}
              {saveSuccess && (
                <div className="bg-green-100 border-2 border-green-600 text-green-800 font-bold p-4 rounded-lg">Profile saved!</div>
              )}

              <Button type="button" size="lg" disabled={saving} onClick={handleSave} className="w-full font-black text-xl">
                {saving ? "SAVING..." : "SAVE PROFILE"}
              </Button>
            </div>

            <PushNotificationCard />

            {session && !profile.phone && !profile.email && (
              <div className="bg-amber-50 border-4 border-amber-500 rounded-2xl p-5">
                <p className="font-black text-amber-900 text-lg">No contact info added yet.</p>
                <p className="font-bold text-amber-800 mt-1">Add a phone number or email so others can reach you.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function PushNotificationCard() {
  const { state, subscribe, unsubscribe } = usePushNotifications();

  if (state === "unsupported") return null;

  const handleToggle = async () => {
    if (state === "granted") {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="bg-white border-4 border-black rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        {state === "granted" ? (
          <BellRing className="w-6 h-6 text-green-600 shrink-0" />
        ) : (
          <BellOff className="w-6 h-6 text-gray-400 shrink-0" />
        )}
        <div>
          <p className="font-black text-lg uppercase">Push Notifications</p>
          <p className="text-sm font-medium text-gray-500">
            {state === "granted"
              ? "You'll get notified for new messages and vehicle updates."
              : state === "denied"
              ? "Blocked in browser settings — allow notifications to enable."
              : "Get notified for new messages and vehicle updates."}
          </p>
        </div>
      </div>

      {state !== "denied" && (
        <Button
          type="button"
          size="lg"
          disabled={state === "loading"}
          onClick={handleToggle}
          className={`w-full font-black uppercase ${
            state === "granted"
              ? "bg-white text-black border-4 border-black hover:bg-gray-100"
              : ""
          }`}
          variant={state === "granted" ? "outline" : "default"}
        >
          <Bell className="w-5 h-5 mr-2" />
          {state === "loading"
            ? "LOADING..."
            : state === "granted"
            ? "DISABLE NOTIFICATIONS"
            : "ENABLE NOTIFICATIONS"}
        </Button>
      )}

      {state === "denied" && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-gray-500">
            Open your browser settings and allow notifications for this site, then reload.
          </p>
        </div>
      )}
    </div>
  );
}
