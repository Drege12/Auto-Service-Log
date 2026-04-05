import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, mechanicsTable, carsTable, maintenanceEntriesTable } from "@workspace/db";
import { eq, ne, count, sum, avg, desc } from "drizzle-orm";
import type { Request, Response } from "express";
import { sendMonthlyMileageReminders } from "../lib/scheduler";

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
      .select({ id: mechanicsTable.id, username: mechanicsTable.username, displayName: mechanicsTable.displayName, isAdmin: mechanicsTable.isAdmin, role: mechanicsTable.role, phone: mechanicsTable.phone, email: mechanicsTable.email, contactPublic: mechanicsTable.contactPublic, createdAt: mechanicsTable.createdAt })
      .from(mechanicsTable)
      .orderBy(mechanicsTable.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts." });
  }
});

// Create a new mechanic account
router.post("/admin/mechanics", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const { username, password, displayName, isAdmin, role } = req.body as {
    username?: string;
    password?: string;
    displayName?: string;
    isAdmin?: boolean;
    role?: string;
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
      role: role === "driver" ? "driver" : "mechanic",
    }).returning({ id: mechanicsTable.id, username: mechanicsTable.username, displayName: mechanicsTable.displayName, isAdmin: mechanicsTable.isAdmin, role: mechanicsTable.role, createdAt: mechanicsTable.createdAt });

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

  const { username, displayName, password, isAdmin, role } = req.body as {
    username?: string;
    displayName?: string;
    password?: string;
    isAdmin?: boolean;
    role?: string;
  };

  try {
    // Validate first
    if (username !== undefined && !username.trim()) {
      res.status(400).json({ error: "Username cannot be empty." }); return;
    }
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
    if (username !== undefined) {
      const normalized = username.trim().toLowerCase();
      const [existing] = await db.select({ id: mechanicsTable.id }).from(mechanicsTable).where(eq(mechanicsTable.username, normalized));
      if (existing && existing.id !== targetId) {
        res.status(409).json({ error: "Username already taken." }); return;
      }
    }

    const hasChanges = username !== undefined || displayName !== undefined || password !== undefined || isAdmin !== undefined || role !== undefined;
    if (!hasChanges) { res.status(400).json({ error: "Nothing to update." }); return; }

    const setValues: { username?: string; displayName?: string; passwordHash?: string; isAdmin?: number; role?: string } = {};
    if (username !== undefined) setValues.username = username.trim().toLowerCase();
    if (displayName !== undefined) setValues.displayName = displayName.trim();
    if (password !== undefined) setValues.passwordHash = await bcrypt.hash(password, 10);
    if (isAdmin !== undefined) setValues.isAdmin = isAdmin ? 1 : 0;
    if (role !== undefined) setValues.role = role === "driver" ? "driver" : "mechanic";

    const [updated] = await db.update(mechanicsTable)
      .set(setValues)
      .where(eq(mechanicsTable.id, targetId))
      .returning({ id: mechanicsTable.id, username: mechanicsTable.username, displayName: mechanicsTable.displayName, isAdmin: mechanicsTable.isAdmin, role: mechanicsTable.role, createdAt: mechanicsTable.createdAt });

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

// Maintenance statistics grouped by year/make/model/description
router.get("/admin/stats", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;
  try {
    const rows = await db
      .select({
        year: carsTable.year,
        make: carsTable.make,
        model: carsTable.model,
        description: maintenanceEntriesTable.description,
        entryCount: count(),
        totalHours: sum(maintenanceEntriesTable.hours),
        avgHours: avg(maintenanceEntriesTable.hours),
        totalCost: sum(maintenanceEntriesTable.cost),
        avgCost: avg(maintenanceEntriesTable.cost),
      })
      .from(maintenanceEntriesTable)
      .innerJoin(carsTable, eq(maintenanceEntriesTable.carId, carsTable.id))
      .groupBy(carsTable.year, carsTable.make, carsTable.model, maintenanceEntriesTable.description)
      .orderBy(desc(carsTable.year), carsTable.make, carsTable.model, maintenanceEntriesTable.description);

    res.json(rows.map(r => ({
      year: r.year,
      make: r.make,
      model: r.model,
      description: r.description,
      entryCount: Number(r.entryCount),
      totalHours: r.totalHours != null ? Number(r.totalHours) : null,
      avgHours: r.avgHours != null ? Number(r.avgHours) : null,
      totalCost: r.totalCost != null ? Number(r.totalCost) : null,
      avgCost: r.avgCost != null ? Number(r.avgCost) : null,
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch statistics." });
  }
});

// Reassign a car to a different mechanic
router.patch("/admin/cars/:carId/reassign", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const carId = parseInt(req.params.carId, 10);
  if (isNaN(carId)) { res.status(400).json({ error: "Invalid car ID." }); return; }

  const { mechanicId } = req.body as { mechanicId?: number | null };

  try {
    // null clears the tech assignment; otherwise validate the mechanic exists
    if (mechanicId != null) {
      if (isNaN(Number(mechanicId))) {
        res.status(400).json({ error: "Invalid mechanicId." }); return;
      }
      const [mechanic] = await db.select({ id: mechanicsTable.id }).from(mechanicsTable).where(eq(mechanicsTable.id, Number(mechanicId)));
      if (!mechanic) { res.status(404).json({ error: "Mechanic not found." }); return; }
    }

    const [updated] = await db.update(carsTable)
      .set({ mechanicId: mechanicId != null ? Number(mechanicId) : null })
      .where(eq(carsTable.id, carId))
      .returning({ id: carsTable.id });

    if (!updated) { res.status(404).json({ error: "Car not found." }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to reassign car." });
  }
});

// Assign a driver/client to a vehicle (sets linkedMechanicId)
router.patch("/admin/cars/:carId/assign-driver", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const carId = parseInt(req.params.carId, 10);
  if (isNaN(carId)) { res.status(400).json({ error: "Invalid car ID." }); return; }

  const { driverId } = req.body as { driverId?: number | null };

  try {
    // null clears the assignment; otherwise validate the driver exists
    if (driverId != null) {
      const [mechanic] = await db.select({ id: mechanicsTable.id }).from(mechanicsTable).where(eq(mechanicsTable.id, Number(driverId)));
      if (!mechanic) { res.status(404).json({ error: "Account not found." }); return; }
    }

    const [updated] = await db.update(carsTable)
      .set({ linkedMechanicId: driverId != null ? Number(driverId) : null })
      .where(eq(carsTable.id, carId))
      .returning({ id: carsTable.id });

    if (!updated) { res.status(404).json({ error: "Car not found." }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to assign client to car." });
  }
});

// Manually trigger the monthly mileage reminder (admin only — for testing)
router.post("/admin/trigger-mileage-reminders", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  sendMonthlyMileageReminders().catch(console.error);
  res.json({ ok: true, message: "Mileage reminders sent to subscribed drivers." });
});

// Send a test push to a specific mechanic for a specific car (admin only)
router.post("/admin/test-push/:mechanicId/:carId", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const mechanicId = parseInt(req.params.mechanicId, 10);
  const carId = parseInt(req.params.carId, 10);
  const [car] = await db.select({ year: carsTable.year, make: carsTable.make, model: carsTable.model })
    .from(carsTable).where(eq(carsTable.id, carId));
  if (!car) { res.status(404).json({ error: "Car not found" }); return; }
  const label = `${car.year} ${car.make} ${car.model}`;
  const { sendPushToMechanic } = await import("../lib/push");
  await sendPushToMechanic(mechanicId, {
    title: "Mileage Reminder",
    body: `Time to log your mileage for your ${label}.`,
    url: `cars/${carId}`,
  });
  res.json({ ok: true, message: `Push sent to mechanic ${mechanicId} for ${label}` });
});

export default router;
