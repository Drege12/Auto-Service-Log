import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const carsTable = pgTable("cars", {
  id: serial("id").primaryKey(),
  stockNumber: text("stock_number").notNull(),
  year: integer("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  vin: text("vin"),
  color: text("color"),
  mileage: integer("mileage"),
  originalMileage: integer("original_mileage"),
  status: text("status"),
  notes: text("notes"),
  repairNotes: text("repair_notes"),
  partsCost: numeric("parts_cost"),
  laborHours: numeric("labor_hours"),
  laborRate: numeric("labor_rate"),
  actualRepairNotes: text("actual_repair_notes"),
  actualPartsCost: numeric("actual_parts_cost"),
  actualLaborHours: numeric("actual_labor_hours"),
  sold: integer("sold").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCarSchema = createInsertSchema(carsTable).omit({ id: true, createdAt: true, originalMileage: true, repairNotes: true, partsCost: true, laborHours: true, laborRate: true, actualRepairNotes: true, actualPartsCost: true, actualLaborHours: true });
export type InsertCar = z.infer<typeof insertCarSchema>;
export type Car = typeof carsTable.$inferSelect;

export const inspectionItemsTable = pgTable("inspection_items", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => carsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  item: text("item").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
});

export const insertInspectionItemSchema = createInsertSchema(inspectionItemsTable).omit({ id: true });
export type InsertInspectionItem = z.infer<typeof insertInspectionItemSchema>;
export type InspectionItem = typeof inspectionItemsTable.$inferSelect;

export const maintenanceEntriesTable = pgTable("maintenance_entries", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => carsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  description: text("description").notNull(),
  technician: text("technician"),
  cost: numeric("cost"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMaintenanceEntrySchema = createInsertSchema(maintenanceEntriesTable).omit({ id: true, createdAt: true });
export type InsertMaintenanceEntry = z.infer<typeof insertMaintenanceEntrySchema>;
export type MaintenanceEntry = typeof maintenanceEntriesTable.$inferSelect;

export const mileageEntriesTable = pgTable("mileage_entries", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => carsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  odometer: integer("odometer").notNull(),
  reason: text("reason").notNull(),
  technician: text("technician"),
  notes: text("notes"),
  fuelLevel: text("fuel_level"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMileageEntrySchema = createInsertSchema(mileageEntriesTable).omit({ id: true, createdAt: true });
export type InsertMileageEntry = z.infer<typeof insertMileageEntrySchema>;
export type MileageEntry = typeof mileageEntriesTable.$inferSelect;

export const todosTable = pgTable("todos", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => carsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"),
  completed: integer("completed").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTodoSchema = createInsertSchema(todosTable).omit({ id: true, createdAt: true });
export type InsertTodo = z.infer<typeof insertTodoSchema>;
export type Todo = typeof todosTable.$inferSelect;
