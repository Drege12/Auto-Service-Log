import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, mechanicsTable, carsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

async function requireAdmin(req: Request, res: Response): Promise<number | null> {
  const raw = req.headers["x-mechanic-id"];
  if (!raw) { res.status(401).json({ error: "Not authenticated." }); return null; }
  const id = parseInt(String(raw), 10);
  if (isNaN(id)) { res.status(401).json({ error: "Not authenticated." }); return null; }
  const [m] = await db.select({ isAdmin: mechanicsTable.isAdmin }).from(mechanicsTable).where(eq(mechanicsTable.id, id));
  if (!m || m.isAdmin !== 1) { res.status(403).json({ error: "Admin access required." }); return null; }
  return id;
}

// List all mechanics
router.get("/admin/mechanics", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;
  try {
    const rows = await db
      .select({ id: mechanicsTable.id, username: mechanicsTable.username, displayName: mechanicsTable.displayName, isAdmin: mechanicsTable.isAdmin, createdAt: mechanicsTable.createdAt })
      .from(mechanicsTable)
      .orderBy(mechanicsTable.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts." });
  }
});

// Create a new mechanic (admin can create without shop code)
router.post("/admin/mechanics", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const { username, password, displayName, isAdmin } = req.body as {
    username?: string;
    password?: string;
    displayName?: string;
    isAdmin?: boolean;
  };

  if (!username?.trim()) { res.status(400).json({ error: "Username is required." }); return; }
  if (!password || password.length < 4) { res.status(400).json({ error: "Password must be at least 4 characters." }); return; }
  if (!displayName?.trim()) { res.status(400).json({ error: "Display name is required." }); return; }

  try {
    const [existing] = await db.select({ id: mechanicsTable.id }).from(mechanicsTable).where(eq(mechanicsTable.username, username.trim().toLowerCase()));
    if (existing) { res.status(409).json({ error: "Username already taken." }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    const [mechanic] = await db.insert(mechanicsTable).values({
      username: username.trim().toLowerCase(),
      passwordHash,
      displayName: displayName.trim(),
      isAdmin: isAdmin ? 1 : 0,
    }).returning({ id: mechanicsTable.id, username: mechanicsTable.username, displayName: mechanicsTable.displayName, isAdmin: mechanicsTable.isAdmin, createdAt: mechanicsTable.createdAt });

    res.status(201).json(mechanic);
  } catch {
    res.status(500).json({ error: "Failed to create account." });
  }
});

// Update a mechanic (display name, password, isAdmin)
router.patch("/admin/mechanics/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid mechanic ID." }); return; }

  const { displayName, password, isAdmin } = req.body as {
    displayName?: string;
    password?: string;
    isAdmin?: boolean;
  };

  try {
    // Validate first
    if (displayName !== undefined && !displayName.trim()) {
      res.status(400).json({ error: "Display name cannot be empty." }); return;
    }
    if (password !== undefined && password.length < 4) {
      res.status(400).json({ error: "Password must be at least 4 characters." }); return;
    }
    if (isAdmin === false && targetId === adminId) {
      const admins = await db.select({ id: mechanicsTable.id }).from(mechanicsTable).where(eq(mechanicsTable.isAdmin, 1));
      if (admins.length <= 1) { res.status(400).json({ error: "Cannot remove admin from the only admin account." }); return; }
    }

    const hasChanges = displayName !== undefined || password !== undefined || isAdmin !== undefined;
    if (!hasChanges) { res.status(400).json({ error: "Nothing to update." }); return; }

    const setValues: { displayName?: string; passwordHash?: string; isAdmin?: number } = {};
    if (displayName !== undefined) setValues.displayName = displayName.trim();
    if (password !== undefined) setValues.passwordHash = await bcrypt.hash(password, 10);
    if (isAdmin !== undefined) setValues.isAdmin = isAdmin ? 1 : 0;

    const [updated] = await db.update(mechanicsTable)
      .set(setValues)
      .where(eq(mechanicsTable.id, targetId))
      .returning({ id: mechanicsTable.id, username: mechanicsTable.username, displayName: mechanicsTable.displayName, isAdmin: mechanicsTable.isAdmin, createdAt: mechanicsTable.createdAt });

    if (!updated) { res.status(404).json({ error: "Account not found." }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update account." });
  }
});

// Delete a mechanic
router.delete("/admin/mechanics/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid mechanic ID." }); return; }
  if (targetId === adminId) { res.status(400).json({ error: "You cannot delete your own account." }); return; }

  try {
    const deleted = await db.delete(mechanicsTable).where(eq(mechanicsTable.id, targetId)).returning({ id: mechanicsTable.id });
    if (!deleted.length) { res.status(404).json({ error: "Account not found." }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete account." });
  }
});

// Reassign a car to a different mechanic
router.patch("/admin/cars/:carId/reassign", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const carId = parseInt(req.params.carId, 10);
  if (isNaN(carId)) { res.status(400).json({ error: "Invalid car ID." }); return; }

  const { mechanicId } = req.body as { mechanicId?: number };
  if (!mechanicId || isNaN(Number(mechanicId))) {
    res.status(400).json({ error: "mechanicId is required." }); return;
  }

  try {
    const [mechanic] = await db.select({ id: mechanicsTable.id }).from(mechanicsTable).where(eq(mechanicsTable.id, Number(mechanicId)));
    if (!mechanic) { res.status(404).json({ error: "Mechanic not found." }); return; }

    const [updated] = await db.update(carsTable)
      .set({ mechanicId: Number(mechanicId) })
      .where(eq(carsTable.id, carId))
      .returning({ id: carsTable.id });

    if (!updated) { res.status(404).json({ error: "Car not found." }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to reassign car." });
  }
});

export default router;
