import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function getMechanicId(req: Request): number | null {
  const raw = req.headers["x-mechanic-id"];
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

// GET /api/push/vapid-public-key
router.get("/push/vapid-public-key", (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) { res.status(503).json({ error: "Push not configured." }); return; }
  res.json({ key });
});

// POST /api/push/subscribe
router.post("/push/subscribe", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "endpoint, keys.p256dh and keys.auth are required." });
    return;
  }

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ mechanicId: me, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { mechanicId: me, p256dh: keys.p256dh, auth: keys.auth },
      });
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save subscription." });
  }
});

// DELETE /api/push/unsubscribe
router.delete("/push/unsubscribe", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: "endpoint is required." }); return; }

  try {
    await db.delete(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.mechanicId, me)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to remove subscription." });
  }
});

export default router;
