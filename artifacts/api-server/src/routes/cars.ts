import { Router, type IRouter } from "express";
import { db, carsTable, inspectionItemsTable, maintenanceEntriesTable, todosTable, insertCarSchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/cars", async (_req, res) => {
  try {
    const cars = await db.select().from(carsTable).orderBy(carsTable.createdAt);
    res.json(cars);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch cars" });
  }
});

router.post("/cars", async (req, res) => {
  try {
    const parsed = insertCarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid car data", details: parsed.error.flatten() });
      return;
    }
    const [car] = await db.insert(carsTable).values(parsed.data).returning();
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
    const [car] = await db.update(carsTable).set(parsed.data).where(eq(carsTable.id, carId)).returning();
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

export default router;
