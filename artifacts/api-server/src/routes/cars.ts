import { Router, type IRouter, type Request } from "express";
import { db, carsTable, inspectionItemsTable, maintenanceEntriesTable, mileageEntriesTable, todosTable, insertCarSchema, mechanicsTable, vehicleNotificationsTable, carNotesLogTable, serviceIntervalsTable } from "@workspace/db";
import { eq, and, max, ne, or, isNull, gt } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function getMechanicId(req: Request): number | null {
  const raw = req.headers["x-mechanic-id"];
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

async function isAdmin(mechanicId: number | null): Promise<boolean> {
  if (!mechanicId) return false;
  const [m] = await db.select({ isAdmin: mechanicsTable.isAdmin }).from(mechanicsTable).where(eq(mechanicsTable.id, mechanicId));
  return m?.isAdmin === 1;
}

// ---------------------------------------------------------------------------
// Notification helper — fire-and-forget, never throws
// ---------------------------------------------------------------------------
async function notifyLinkedParty(
  carId: number,
  actorId: number | null,
  type: string,
  message: string,
  dedupMinutes = 0,
): Promise<void> {
  try {
    const [car] = await db
      .select({ mechanicId: carsTable.mechanicId, linkedMechanicId: carsTable.linkedMechanicId })
      .from(carsTable)
      .where(eq(carsTable.id, carId));

    if (!car || !car.linkedMechanicId || !car.mechanicId) return;

    const recipientId = actorId === car.mechanicId ? car.linkedMechanicId : car.mechanicId;
    if (!recipientId || recipientId === actorId) return;

    if (dedupMinutes > 0) {
      const since = new Date(Date.now() - dedupMinutes * 60 * 1000);
      const existing = await db
        .select({ id: vehicleNotificationsTable.id })
        .from(vehicleNotificationsTable)
        .where(
          and(
            eq(vehicleNotificationsTable.carId, carId),
            eq(vehicleNotificationsTable.recipientId, recipientId),
            eq(vehicleNotificationsTable.type, type),
            gt(vehicleNotificationsTable.createdAt, since),
          )
        )
        .limit(1);
      if (existing.length > 0) return;
    }

    await db.insert(vehicleNotificationsTable).values({ recipientId, actorId, carId, type, message });

    // Push notification to recipient — fire and forget
    import("../lib/push").then(({ sendPushToMechanic }) =>
      sendPushToMechanic(recipientId, {
        type: "vehicle",
        title: "Maintenance Tracker",
        body: message.slice(0, 120),
        url: "notifications",
      })
    ).catch(() => {});
  } catch {
    // Notification failures must never break the main route
  }
}

// ---------------------------------------------------------------------------
// VIN lookup — find a vehicle with this VIN owned by a DIFFERENT mechanic
// ---------------------------------------------------------------------------
router.get("/vin-lookup", async (req, res) => {
  try {
    const vin = String(req.query.vin ?? "").trim().toUpperCase();
    if (!vin) {
      res.status(400).json({ error: "vin query parameter is required" });
      return;
    }
    const mechanicId = getMechanicId(req);
    const vehicleTypeFilter = String(req.query.vehicleType ?? "").trim().toLowerCase() || null;

    const baseConditions = [
      eq(carsTable.vin, vin),
      ...(vehicleTypeFilter ? [eq(carsTable.vehicleType, vehicleTypeFilter)] : []),
    ];

    const rows = await db
      .select({
        id: carsTable.id,
        year: carsTable.year,
        make: carsTable.make,
        model: carsTable.model,
        color: carsTable.color,
        mileage: carsTable.mileage,
        vehicleType: carsTable.vehicleType,
        vehicleSubtype: carsTable.vehicleSubtype,
        carType: carsTable.carType,
        vin: carsTable.vin,
        owner: carsTable.owner,
        mechanicId: carsTable.mechanicId,
        linkedMechanicId: carsTable.linkedMechanicId,
      })
      .from(carsTable)
      .where(
        mechanicId
          ? and(
              ...baseConditions,
              ne(carsTable.mechanicId, mechanicId),
              or(isNull(carsTable.linkedMechanicId), ne(carsTable.linkedMechanicId, mechanicId))
            )
          : and(...baseConditions)
      );

    if (rows.length === 0) {
      res.json({ found: false });
      return;
    }
    const car = rows[0];

    // Resolve the owner's display name (if car has a mechanicId owner)
    let ownerDisplayName: string | null = null;
    if (car.mechanicId) {
      const [m] = await db.select({ displayName: mechanicsTable.displayName }).from(mechanicsTable).where(eq(mechanicsTable.id, car.mechanicId));
      ownerDisplayName = m?.displayName ?? null;
    }

    res.json({ found: true, car: { ...car, ownerDisplayName } });
  } catch (err) {
    res.status(500).json({ error: "Failed to check VIN" });
  }
});

// ---------------------------------------------------------------------------
// Import a vehicle (by source car ID) into the current mechanic's account
// Copies car data + all inspection items, maintenance, mileage, todos
// ---------------------------------------------------------------------------
router.post("/cars/:carId/import", async (req, res) => {
  try {
    const sourceCarId = parseInt(req.params.carId, 10);
    const mechanicId = getMechanicId(req);
    if (!mechanicId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const { stockNumber } = req.body as { stockNumber?: string };

    // Load source car
    const [source] = await db.select().from(carsTable).where(eq(carsTable.id, sourceCarId));
    if (!source) {
      res.status(404).json({ error: "Source vehicle not found" });
      return;
    }

    // Create a copy for this mechanic
    const [newCar] = await db.insert(carsTable).values({
      mechanicId,
      stockNumber: stockNumber?.trim() || source.stockNumber,
      year: source.year,
      make: source.make,
      model: source.model,
      vin: source.vin,
      color: source.color,
      mileage: source.mileage,
      originalMileage: source.originalMileage,
      status: source.status,
      notes: source.notes,
      carType: source.carType as "dealer" | "personal",
      vehicleType: source.vehicleType as "car" | "motorcycle" | "boat" | "atv",
      vehicleSubtype: source.vehicleSubtype,
      owner: source.owner,
      sold: 0,
    }).returning();

    // Copy inspection items
    const inspItems = await db.select().from(inspectionItemsTable).where(eq(inspectionItemsTable.carId, sourceCarId));
    if (inspItems.length > 0) {
      await db.insert(inspectionItemsTable).values(
        inspItems.map(i => ({ carId: newCar.id, category: i.category, item: i.item, status: i.status, notes: i.notes }))
      );
    }

    // Copy maintenance entries
    const maintEntries = await db.select().from(maintenanceEntriesTable).where(eq(maintenanceEntriesTable.carId, sourceCarId));
    if (maintEntries.length > 0) {
      await db.insert(maintenanceEntriesTable).values(
        maintEntries.map(e => ({ carId: newCar.id, date: e.date, description: e.description, technician: e.technician, hours: e.hours, cost: e.cost, notes: e.notes }))
      );
    }

    // Copy mileage entries
    const mileageEntries = await db.select().from(mileageEntriesTable).where(eq(mileageEntriesTable.carId, sourceCarId));
    if (mileageEntries.length > 0) {
      await db.insert(mileageEntriesTable).values(
        mileageEntries.map(e => ({ carId: newCar.id, date: e.date, odometer: e.odometer, reason: e.reason, technician: e.technician, notes: e.notes, fuelLevel: e.fuelLevel }))
      );
    }

    // Copy todos
    const todos = await db.select().from(todosTable).where(eq(todosTable.carId, sourceCarId));
    if (todos.length > 0) {
      await db.insert(todosTable).values(
        todos.map(t => ({ carId: newCar.id, description: t.description, priority: t.priority as "low" | "medium" | "high", completed: 0, notes: t.notes }))
      );
    }

    res.status(201).json(newCar);
  } catch (err) {
    res.status(500).json({ error: "Failed to import vehicle" });
  }
});

// ---------------------------------------------------------------------------
// Cars CRUD — scoped by mechanic
// ---------------------------------------------------------------------------
router.get("/cars", async (req, res) => {
  try {
    const mechanicId = getMechanicId(req);
    const admin = await isAdmin(mechanicId);

    if (admin) {
      const rows = await db
        .select({
          id: carsTable.id,
          mechanicId: carsTable.mechanicId,
          mechanicName: mechanicsTable.displayName,
          stockNumber: carsTable.stockNumber,
          year: carsTable.year,
          make: carsTable.make,
          model: carsTable.model,
          vin: carsTable.vin,
          color: carsTable.color,
          mileage: carsTable.mileage,
          originalMileage: carsTable.originalMileage,
          status: carsTable.status,
          notes: carsTable.notes,
          repairNotes: carsTable.repairNotes,
          partsCost: carsTable.partsCost,
          laborHours: carsTable.laborHours,
          laborRate: carsTable.laborRate,
          actualRepairNotes: carsTable.actualRepairNotes,
          actualPartsCost: carsTable.actualPartsCost,
          actualLaborHours: carsTable.actualLaborHours,
          carType: carsTable.carType,
          vehicleType: carsTable.vehicleType,
          vehicleSubtype: carsTable.vehicleSubtype,
          owner: carsTable.owner,
          sold: carsTable.sold,
          createdAt: carsTable.createdAt,
          linkedMechanicId: carsTable.linkedMechanicId,
        })
        .from(carsTable)
        .leftJoin(mechanicsTable, eq(carsTable.mechanicId, mechanicsTable.id))
        .orderBy(carsTable.createdAt);
      res.json(rows.map(r => ({ ...r, isLinkedCar: r.linkedMechanicId != null })));
      return;
    }

    if (!mechanicId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check the user's role — drivers only see cars explicitly assigned to them
    const [me] = await db
      .select({ role: mechanicsTable.role })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, mechanicId));

    const isDriver = me?.role === "driver";

    if (isDriver) {
      // Drivers see cars they created themselves + cars explicitly assigned to them as a client
      const ownedCars = await db
        .select()
        .from(carsTable)
        .where(eq(carsTable.mechanicId, mechanicId))
        .orderBy(carsTable.createdAt);

      const assignedCars = await db
        .select()
        .from(carsTable)
        .where(eq(carsTable.linkedMechanicId, mechanicId))
        .orderBy(carsTable.createdAt);

      // Merge, avoiding duplicates (a driver shouldn't own AND be the linked client, but just in case)
      const assignedIds = new Set(assignedCars.map(c => c.id));
      const owned = ownedCars.filter(c => !assignedIds.has(c.id));
      const assigned = assignedCars.map(r => ({ ...r, isLinkedCar: true as const }));
      res.json([...owned, ...assigned]);
      return;
    }

    // Mechanic: show their own cars + cars linked to them
    const ownedCars = await db
      .select()
      .from(carsTable)
      .where(eq(carsTable.mechanicId, mechanicId))
      .orderBy(carsTable.createdAt);

    // Linked cars (cars owned by others that this mechanic services)
    const linkedCars = await db
      .select()
      .from(carsTable)
      .where(eq(carsTable.linkedMechanicId, mechanicId))
      .orderBy(carsTable.createdAt);

    const linked = linkedCars.map(r => ({ ...r, isLinkedCar: true as const }));
    res.json([...ownedCars, ...linked]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch cars" });
  }
});

router.post("/cars", async (req, res) => {
  try {
    const mechanicId = getMechanicId(req);
    const parsed = insertCarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid car data", details: parsed.error.flatten() });
      return;
    }

    // Check if the creator is a driver — drivers don't act as the technician on their own cars
    let isDriver = false;
    if (mechanicId) {
      const [me] = await db.select({ role: mechanicsTable.role }).from(mechanicsTable).where(eq(mechanicsTable.id, mechanicId));
      isDriver = me?.role === "driver";
    }

    const [car] = await db.insert(carsTable).values({
      ...parsed.data,
      // Drivers: no tech assigned, but link themselves as the client so the car stays visible to them
      mechanicId: isDriver ? null : (mechanicId ?? undefined),
      linkedMechanicId: isDriver ? mechanicId : undefined,
      originalMileage: parsed.data.mileage ?? null,
    }).returning();
    res.status(201).json(car);
  } catch (err) {
    res.status(500).json({ error: "Failed to create car" });
  }
});

router.get("/cars/:carId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const [car] = await db.select().from(carsTable).where(eq(carsTable.id, carId));
    if (!car) {
      res.status(404).json({ error: "Car not found" });
      return;
    }
    // Resolve linked mechanic (client/driver) display name if present
    let linkedMechanicName: string | null = null;
    if (car.linkedMechanicId) {
      const [m] = await db.select({ displayName: mechanicsTable.displayName }).from(mechanicsTable).where(eq(mechanicsTable.id, car.linkedMechanicId));
      linkedMechanicName = m?.displayName ?? null;
    }
    // Resolve assigned technician display name if present
    let mechanicName: string | null = null;
    if (car.mechanicId) {
      const [m] = await db.select({ displayName: mechanicsTable.displayName }).from(mechanicsTable).where(eq(mechanicsTable.id, car.mechanicId));
      mechanicName = m?.displayName ?? null;
    }
    res.json({ ...car, linkedMechanicName, mechanicName });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch car" });
  }
});

// ---------------------------------------------------------------------------
// Link / unlink a mechanic to a vehicle they service but don't own
// ---------------------------------------------------------------------------
router.post("/cars/:carId/link", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const mechanicId = getMechanicId(req);
    if (!mechanicId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const [car] = await db.select({ mechanicId: carsTable.mechanicId }).from(carsTable).where(eq(carsTable.id, carId));
    if (!car) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    if (car.mechanicId === mechanicId) {
      res.status(400).json({ error: "You already own this vehicle" });
      return;
    }
    const [updated] = await db.update(carsTable).set({ linkedMechanicId: mechanicId }).where(eq(carsTable.id, carId)).returning();
    res.json(updated);
    void notifyLinkedParty(carId, mechanicId, "linked", "A mechanic linked your vehicle to their account");
  } catch (err) {
    res.status(500).json({ error: "Failed to link vehicle" });
  }
});

router.delete("/cars/:carId/link", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const mechanicId = getMechanicId(req);
    if (!mechanicId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const [updated] = await db.update(carsTable).set({ linkedMechanicId: null }).where(eq(carsTable.id, carId)).returning();
    if (!updated) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to unlink vehicle" });
  }
});

router.put("/cars/:carId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const parsed = insertCarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid car data", details: parsed.error.flatten() });
      return;
    }
    const [existing] = await db.select({ originalMileage: carsTable.originalMileage })
      .from(carsTable).where(eq(carsTable.id, carId));
    const extraFields = existing?.originalMileage === null && parsed.data.mileage != null
      ? { originalMileage: parsed.data.mileage }
      : {};
    const [car] = await db.update(carsTable)
      .set({ ...parsed.data, ...extraFields })
      .where(eq(carsTable.id, carId))
      .returning();
    if (!car) {
      res.status(404).json({ error: "Car not found" });
      return;
    }
    res.json(car);
  } catch (err) {
    res.status(500).json({ error: "Failed to update car" });
  }
});

router.patch("/cars/:carId/notes", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const { notes } = req.body as { notes?: string };
    const [car] = await db
      .update(carsTable)
      .set({ notes: notes ?? null })
      .where(eq(carsTable.id, carId))
      .returning();
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }
    res.json({ notes: car.notes });
    if (notes?.trim()) void notifyLinkedParty(carId, getMechanicId(req), "notes_updated", "Vehicle notes were updated", 15);
  } catch {
    res.status(500).json({ error: "Failed to save notes" });
  }
});

// --- Car Notes Log ---

router.get("/cars/:carId/notes-log", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const rows = await db
      .select({
        id: carNotesLogTable.id,
        body: carNotesLogTable.body,
        authorName: mechanicsTable.displayName,
        createdAt: carNotesLogTable.createdAt,
      })
      .from(carNotesLogTable)
      .leftJoin(mechanicsTable, eq(carNotesLogTable.authorId, mechanicsTable.id))
      .where(eq(carNotesLogTable.carId, carId))
      .orderBy(carNotesLogTable.createdAt);

    // Auto-migrate legacy single-field note if log is empty
    if (rows.length === 0) {
      const [car] = await db.select({ notes: carsTable.notes }).from(carsTable).where(eq(carsTable.id, carId));
      if (car?.notes?.trim()) {
        const [entry] = await db
          .insert(carNotesLogTable)
          .values({ carId, body: car.notes.trim(), authorId: null })
          .returning();
        await db.update(carsTable).set({ notes: null }).where(eq(carsTable.id, carId));
        const result = [{ id: entry.id, body: entry.body, authorName: null, createdAt: entry.createdAt }];
        res.json(result);
        return;
      }
    }

    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to load notes" });
  }
});

router.post("/cars/:carId/notes-log", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const mechanicId = getMechanicId(req);
    const { body } = req.body as { body?: string };
    if (!body?.trim()) { res.status(400).json({ error: "Note body is required" }); return; }

    const [entry] = await db
      .insert(carNotesLogTable)
      .values({ carId, body: body.trim(), authorId: mechanicId })
      .returning();

    const [author] = mechanicId
      ? await db.select({ displayName: mechanicsTable.displayName }).from(mechanicsTable).where(eq(mechanicsTable.id, mechanicId))
      : [];

    res.json({
      id: entry.id,
      body: entry.body,
      authorName: author?.displayName ?? null,
      createdAt: entry.createdAt.toISOString(),
    });

    void notifyLinkedParty(carId, mechanicId, "notes_updated", "A new note was added to your vehicle", 0);
  } catch {
    res.status(500).json({ error: "Failed to add note" });
  }
});

router.delete("/cars/:carId/notes-log/:noteId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const noteId = parseInt(req.params.noteId, 10);
    await db
      .delete(carNotesLogTable)
      .where(and(eq(carNotesLogTable.id, noteId), eq(carNotesLogTable.carId, carId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

router.patch("/cars/:carId/sold", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const { sold } = req.body;
    if (typeof sold !== "boolean") {
      res.status(400).json({ error: "sold must be a boolean" });
      return;
    }
    const [car] = await db
      .update(carsTable)
      .set({ sold: sold ? 1 : 0 })
      .where(eq(carsTable.id, carId))
      .returning();
    if (!car) {
      res.status(404).json({ error: "Car not found" });
      return;
    }
    res.json(car);
  } catch (err) {
    res.status(500).json({ error: "Failed to update car" });
  }
});

router.delete("/cars/:carId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    await db.delete(carsTable).where(eq(carsTable.id, carId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete car" });
  }
});

router.get("/cars/:carId/inspection", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const items = await db.select().from(inspectionItemsTable).where(eq(inspectionItemsTable.carId, carId));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inspection" });
  }
});

router.post("/cars/:carId/inspection", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const itemsSchema = z.array(z.object({
      id: z.number().optional(),
      category: z.string(),
      item: z.string(),
      status: z.enum(["pass", "fail", "advisory", "na", "pending"]),
      notes: z.string().optional().nullable(),
    }));
    const parsed = itemsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid inspection data" });
      return;
    }
    await db.delete(inspectionItemsTable).where(eq(inspectionItemsTable.carId, carId));
    if (parsed.data.length === 0) {
      res.json([]);
      return;
    }
    const inserted = await db.insert(inspectionItemsTable).values(
      parsed.data.map(i => ({
        carId,
        category: i.category,
        item: i.item,
        status: i.status,
        notes: i.notes ?? null,
      }))
    ).returning();
    res.json(inserted);
    void notifyLinkedParty(carId, getMechanicId(req), "inspection_saved", "Inspection checklist updated", 30);
  } catch (err) {
    res.status(500).json({ error: "Failed to save inspection" });
  }
});

router.get("/cars/:carId/maintenance", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entries = await db.select().from(maintenanceEntriesTable).where(eq(maintenanceEntriesTable.carId, carId));
    res.json(entries.map(e => ({
      ...e,
      hours: e.hours != null ? Number(e.hours) : null,
      cost: e.cost != null ? Number(e.cost) : null,
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch maintenance" });
  }
});

router.post("/cars/:carId/maintenance", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entrySchema = z.object({
      date: z.string(),
      description: z.string(),
      technician: z.string().optional().nullable(),
      hours: z.number().optional().nullable(),
      cost: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid maintenance data" });
      return;
    }
    const [entry] = await db.insert(maintenanceEntriesTable).values({
      carId,
      ...parsed.data,
      hours: parsed.data.hours?.toString() ?? null,
      cost: parsed.data.cost?.toString() ?? null,
    }).returning();
    res.status(201).json({
      ...entry,
      hours: entry.hours != null ? Number(entry.hours) : null,
      cost: entry.cost != null ? Number(entry.cost) : null,
    });
    void notifyLinkedParty(carId, getMechanicId(req), "maintenance_added", `New maintenance entry: ${parsed.data.description}`);
  } catch (err) {
    res.status(500).json({ error: "Failed to create maintenance entry" });
  }
});

router.put("/cars/:carId/maintenance/:entryId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entryId = parseInt(req.params.entryId, 10);
    const entrySchema = z.object({
      date: z.string(),
      description: z.string(),
      technician: z.string().optional().nullable(),
      hours: z.number().optional().nullable(),
      cost: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid maintenance data" });
      return;
    }
    const [entry] = await db.update(maintenanceEntriesTable)
      .set({
        ...parsed.data,
        hours: parsed.data.hours?.toString() ?? null,
        cost: parsed.data.cost?.toString() ?? null,
      })
      .where(and(eq(maintenanceEntriesTable.id, entryId), eq(maintenanceEntriesTable.carId, carId)))
      .returning();
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json({
      ...entry,
      hours: entry.hours != null ? Number(entry.hours) : null,
      cost: entry.cost != null ? Number(entry.cost) : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update maintenance entry" });
  }
});

router.delete("/cars/:carId/maintenance/:entryId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entryId = parseInt(req.params.entryId, 10);
    await db.delete(maintenanceEntriesTable).where(and(eq(maintenanceEntriesTable.id, entryId), eq(maintenanceEntriesTable.carId, carId)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete maintenance entry" });
  }
});

router.get("/cars/:carId/todos", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const todos = await db.select().from(todosTable).where(eq(todosTable.carId, carId));
    res.json(todos.map(t => ({ ...t, completed: t.completed === 1 })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch todos" });
  }
});

router.post("/cars/:carId/todos", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const todoSchema = z.object({
      description: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      completed: z.boolean().optional().default(false),
      notes: z.string().optional().nullable(),
    });
    const parsed = todoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid todo data" });
      return;
    }
    const [todo] = await db.insert(todosTable).values({
      carId,
      description: parsed.data.description,
      priority: parsed.data.priority,
      completed: parsed.data.completed ? 1 : 0,
      notes: parsed.data.notes ?? null,
    }).returning();
    res.status(201).json({ ...todo, completed: todo.completed === 1 });
    void notifyLinkedParty(carId, getMechanicId(req), "todo_added", `New task added: ${parsed.data.description}`);
  } catch (err) {
    res.status(500).json({ error: "Failed to create todo" });
  }
});

router.put("/cars/:carId/todos/:todoId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const todoId = parseInt(req.params.todoId, 10);
    const todoSchema = z.object({
      description: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      completed: z.boolean().optional().default(false),
      notes: z.string().optional().nullable(),
    });
    const parsed = todoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid todo data" });
      return;
    }
    const [todo] = await db.update(todosTable)
      .set({
        description: parsed.data.description,
        priority: parsed.data.priority,
        completed: parsed.data.completed ? 1 : 0,
        notes: parsed.data.notes ?? null,
      })
      .where(and(eq(todosTable.id, todoId), eq(todosTable.carId, carId)))
      .returning();
    if (!todo) {
      res.status(404).json({ error: "Todo not found" });
      return;
    }
    res.json({ ...todo, completed: todo.completed === 1 });
  } catch (err) {
    res.status(500).json({ error: "Failed to update todo" });
  }
});

router.delete("/cars/:carId/todos/:todoId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const todoId = parseInt(req.params.todoId, 10);
    await db.delete(todosTable).where(and(eq(todosTable.id, todoId), eq(todosTable.carId, carId)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete todo" });
  }
});

router.get("/cars/:carId/mileage", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entries = await db.select().from(mileageEntriesTable)
      .where(eq(mileageEntriesTable.carId, carId))
      .orderBy(mileageEntriesTable.odometer);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch mileage log" });
  }
});

router.post("/cars/:carId/mileage", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entrySchema = z.object({
      date: z.string(),
      odometer: z.number().int().positive(),
      reason: z.string(),
      technician: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      fuelLevel: z.string().optional().nullable(),
    });
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid mileage data" });
      return;
    }
    const [entry] = await db.insert(mileageEntriesTable).values({ carId, ...parsed.data }).returning();

    const [currentCar] = await db.select().from(carsTable).where(eq(carsTable.id, carId));
    if (currentCar) {
      const updates: Record<string, number | null> = {};
      if (!currentCar.mileage || parsed.data.odometer > currentCar.mileage) {
        updates.mileage = parsed.data.odometer;
      }
      if (currentCar.originalMileage === null) {
        updates.originalMileage = currentCar.mileage ?? parsed.data.odometer;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(carsTable).set(updates).where(eq(carsTable.id, carId));
      }
    }

    res.status(201).json(entry);
    void notifyLinkedParty(carId, getMechanicId(req), "mileage_added", `Mileage logged: ${parsed.data.odometer.toLocaleString()} (${parsed.data.reason})`);
  } catch (err) {
    res.status(500).json({ error: "Failed to create mileage entry" });
  }
});

router.delete("/cars/:carId/mileage/:entryId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entryId = parseInt(req.params.entryId, 10);

    await db.delete(mileageEntriesTable).where(and(eq(mileageEntriesTable.id, entryId), eq(mileageEntriesTable.carId, carId)));

    const [{ maxOdometer }] = await db
      .select({ maxOdometer: max(mileageEntriesTable.odometer) })
      .from(mileageEntriesTable)
      .where(eq(mileageEntriesTable.carId, carId));

    if (maxOdometer !== null) {
      await db.update(carsTable).set({ mileage: maxOdometer }).where(eq(carsTable.id, carId));
    } else {
      const [car] = await db.select().from(carsTable).where(eq(carsTable.id, carId));
      if (car) {
        await db.update(carsTable).set({ mileage: car.originalMileage }).where(eq(carsTable.id, carId));
      }
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete mileage entry" });
  }
});

router.patch("/cars/:carId/costs", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const costsSchema = z.object({
      repairNotes: z.string().optional().nullable(),
      partsCost: z.number().optional().nullable(),
      laborHours: z.number().optional().nullable(),
      laborRate: z.number().optional().nullable(),
      actualRepairNotes: z.string().optional().nullable(),
      actualPartsCost: z.number().optional().nullable(),
      actualLaborHours: z.number().optional().nullable(),
    });
    const parsed = costsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid cost data" });
      return;
    }
    const updates: Record<string, string | null> = {};
    if (parsed.data.repairNotes !== undefined) updates.repairNotes = parsed.data.repairNotes ?? null;
    if (parsed.data.partsCost !== undefined) updates.partsCost = parsed.data.partsCost != null ? String(parsed.data.partsCost) : null;
    if (parsed.data.laborHours !== undefined) updates.laborHours = parsed.data.laborHours != null ? String(parsed.data.laborHours) : null;
    if (parsed.data.laborRate !== undefined) updates.laborRate = parsed.data.laborRate != null ? String(parsed.data.laborRate) : null;
    if (parsed.data.actualRepairNotes !== undefined) updates.actualRepairNotes = parsed.data.actualRepairNotes ?? null;
    if (parsed.data.actualPartsCost !== undefined) updates.actualPartsCost = parsed.data.actualPartsCost != null ? String(parsed.data.actualPartsCost) : null;
    if (parsed.data.actualLaborHours !== undefined) updates.actualLaborHours = parsed.data.actualLaborHours != null ? String(parsed.data.actualLaborHours) : null;
    const [car] = await db.update(carsTable).set(updates).where(eq(carsTable.id, carId)).returning();
    if (!car) {
      res.status(404).json({ error: "Car not found" });
      return;
    }
    res.json(car);
  } catch (err) {
    res.status(500).json({ error: "Failed to update repair costs" });
  }
});

// ── Service Intervals ─────────────────────────────────────────────────────────

const serviceIntervalBodySchema = z.object({
  name: z.string().min(1),
  intervalType: z.enum(["miles", "hours", "seasonal"]),
  intervalValue: z.number().int().positive().optional().nullable(),
  targetMonths: z.string().optional().nullable(),
  lastServiceReading: z.number().int().optional().nullable(),
  lastServiceDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get("/cars/:carId/service-intervals", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const rows = await db.select().from(serviceIntervalsTable)
      .where(eq(serviceIntervalsTable.carId, carId))
      .orderBy(serviceIntervalsTable.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch service intervals" });
  }
});

router.post("/cars/:carId/service-intervals", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const parsed = serviceIntervalBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
    const [row] = await db.insert(serviceIntervalsTable).values({
      carId,
      ...parsed.data,
      intervalValue: parsed.data.intervalValue ?? null,
      targetMonths: parsed.data.targetMonths ?? null,
      lastServiceReading: parsed.data.lastServiceReading ?? null,
      lastServiceDate: parsed.data.lastServiceDate ?? null,
      notes: parsed.data.notes ?? null,
    }).returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Failed to create service interval" });
  }
});

router.put("/cars/:carId/service-intervals/:intervalId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const intervalId = parseInt(req.params.intervalId, 10);
    const parsed = serviceIntervalBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
    const [row] = await db.update(serviceIntervalsTable)
      .set({
        ...parsed.data,
        intervalValue: parsed.data.intervalValue ?? null,
        targetMonths: parsed.data.targetMonths ?? null,
        notes: parsed.data.notes ?? null,
      })
      .where(and(eq(serviceIntervalsTable.id, intervalId), eq(serviceIntervalsTable.carId, carId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update service interval" });
  }
});

router.patch("/cars/:carId/service-intervals/:intervalId/done", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const intervalId = parseInt(req.params.intervalId, 10);
    const parsed = z.object({
      lastServiceReading: z.number().int().optional().nullable(),
      lastServiceDate: z.string(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
    const [row] = await db.update(serviceIntervalsTable)
      .set({
        lastServiceReading: parsed.data.lastServiceReading ?? null,
        lastServiceDate: parsed.data.lastServiceDate,
      })
      .where(and(eq(serviceIntervalsTable.id, intervalId), eq(serviceIntervalsTable.carId, carId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to mark done" });
  }
});

router.delete("/cars/:carId/service-intervals/:intervalId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const intervalId = parseInt(req.params.intervalId, 10);
    await db.delete(serviceIntervalsTable)
      .where(and(eq(serviceIntervalsTable.id, intervalId), eq(serviceIntervalsTable.carId, carId)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete service interval" });
  }
});

export default router;
