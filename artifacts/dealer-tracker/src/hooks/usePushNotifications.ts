import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  try {
    const raw = localStorage.getItem("dt_mechanic");
    if (!raw) return {};
    const { mechanicId } = JSON.parse(raw);
    return { "Content-Type": "application/json", "X-Mechanic-Id": String(mechanicId) };
  } catch { return {}; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export type PushState = "unsupported" | "denied" | "granted" | "default" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready.then(reg => {
      setSwReg(reg);
      setState(Notification.permission === "granted" ? "granted"
        : Notification.permission === "denied" ? "denied"
        : "default");
    });
  }, []);

  const subscribe = async (): Promise<boolean> => {
    if (!swReg) return false;
    try {
      setState("loading");
      const r = await fetch(`${BASE}/api/push/vapid-public-key`, { headers: authHeaders() });
      if (!r.ok) { setState("default"); return false; }
      const { key } = await r.json();

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission as PushState); return false; }

      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await fetch(`${BASE}/api/push/subscribe`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });

      setState(res.ok ? "granted" : "default");
      return res.ok;
    } catch {
      setState("default");
      return false;
    }
  };

  const unsubscribe = async (): Promise<void> => {
    if (!swReg) return;
    try {
      const sub = await swReg.pushManager.getSubscription();
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch(`${BASE}/api/push/unsubscribe`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ endpoint }),
      });
      setState("default");
    } catch { /* ignore */ }
  };

  return { state, subscribe, unsubscribe };
}
