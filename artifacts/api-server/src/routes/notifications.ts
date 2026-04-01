import { Router } from "express";
import { db, vehicleNotificationsTable, carsTable, mechanicsTable } from "@workspace/db";
import { eq, desc, isNull, and } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function getMechanicId(req: Request): number | null {
  const raw = req.headers["x-mechanic-id"];
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

// GET /api/notifications
router.get("/notifications", async (req: Request, res: Response) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    const rows = await db
      .select({
        id: vehicleNotificationsTable.id,
        actorId: vehicleNotificationsTable.actorId,
        carId: vehicleNotificationsTable.carId,
        type: vehicleNotificationsTable.type,
        message: vehicleNotificationsTable.message,
        readAt: vehicleNotificationsTable.readAt,
        createdAt: vehicleNotificationsTable.createdAt,
        carYear: carsTable.year,
        carMake: carsTable.make,
        carModel: carsTable.model,
        actorName: mechanicsTable.displayName,
      })
      .from(vehicleNotificationsTable)
      .leftJoin(carsTable, eq(vehicleNotificationsTable.carId, carsTable.id))
      .leftJoin(mechanicsTable, eq(vehicleNotificationsTable.actorId, mechanicsTable.id))
      .where(eq(vehicleNotificationsTable.recipientId, me))
      .orderBy(desc(vehicleNotificationsTable.createdAt))
      .limit(60);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

// GET /api/notifications/unread-count
router.get("/notifications/unread-count", async (req: Request, res: Response) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    const rows = await db
      .select({ id: vehicleNotificationsTable.id })
      .from(vehicleNotificationsTable)
      .where(and(eq(vehicleNotificationsTable.recipientId, me), isNull(vehicleNotificationsTable.readAt)));
    res.json({ count: rows.length });
  } catch {
    res.status(500).json({ error: "Failed to fetch unread count." });
  }
});

// POST /api/notifications/read-all
router.post("/notifications/read-all", async (req: Request, res: Response) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    await db
      .update(vehicleNotificationsTable)
      .set({ readAt: new Date() })
      .where(eq(vehicleNotificationsTable.recipientId, me));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark as read." });
  }
});

// DELETE /api/notifications/:id — dismiss one
router.delete("/notifications/:id", async (req: Request, res: Response) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }

  try {
    await db.delete(vehicleNotificationsTable).where(eq(vehicleNotificationsTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete notification." });
  }
});

export default router;
