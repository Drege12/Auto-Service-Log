import { Router, type IRouter, type Request } from "express";
import { db, carsTable, inspectionItemsTable, maintenanceEntriesTable, mileageEntriesTable, todosTable, insertCarSchema, mechanicsTable } from "@workspace/db";
import { eq, and, max, ne } from "drizzle-orm";
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
        mechanicId: carsTable.mechanicId,
      })
      .from(carsTable)
      .where(
        mechanicId
          ? and(eq(carsTable.vin, vin), ne(carsTable.mechanicId, mechanicId))
          : eq(carsTable.vin, vin)
      );

    if (rows.length === 0) {
      res.json({ found: false });
      return;
    }
    const car = rows[0];
    res.json({ found: true, car });
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
        maintEntries.map(e => ({ carId: newCar.id, date: e.date, description: e.description, technician: e.technician, cost: e.cost, notes: e.notes }))
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
        })
        .from(carsTable)
        .leftJoin(mechanicsTable, eq(carsTable.mechanicId, mechanicsTable.id))
        .orderBy(carsTable.createdAt);
      res.json(rows);
      return;
    }

    const cars = mechanicId
      ? await db.select().from(carsTable).where(eq(carsTable.mechanicId, mechanicId)).orderBy(carsTable.createdAt)
      : await db.select().from(carsTable).orderBy(carsTable.createdAt);
    res.json(cars);
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
    const [car] = await db.insert(carsTable).values({
      ...parsed.data,
      mechanicId: mechanicId ?? undefined,
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
    res.json(car);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch car" });
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
  } catch (err) {
    res.status(500).json({ error: "Failed to save inspection" });
  }
});

router.get("/cars/:carId/maintenance", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const entries = await db.select().from(maintenanceEntriesTable).where(eq(maintenanceEntriesTable.carId, carId));
    res.json(entries.map(e => ({ ...e, cost: e.cost ? Number(e.cost) : null })));
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
      cost: parsed.data.cost?.toString() ?? null,
    }).returning();
    res.status(201).json({ ...entry, cost: entry.cost ? Number(entry.cost) : null });
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
      cost: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid maintenance data" });
      return;
    }
    const [entry] = await db.update(maintenanceEntriesTable)
      .set({ ...parsed.data, cost: parsed.data.cost?.toString() ?? null })
      .where(and(eq(maintenanceEntriesTable.id, entryId), eq(maintenanceEntriesTable.carId, carId)))
      .returning();
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json({ ...entry, cost: entry.cost ? Number(entry.cost) : null });
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

export default router;
