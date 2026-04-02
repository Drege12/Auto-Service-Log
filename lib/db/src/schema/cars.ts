import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mechanicsTable = pgTable("mechanics", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isAdmin: integer("is_admin").notNull().default(0),
  role: text("role").notNull().default("mechanic"),
  phone: text("phone"),
  email: text("email"),
  contactPublic: integer("contact_public").notNull().default(0),
  shopCode: text("shop_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMechanicSchema = createInsertSchema(mechanicsTable).omit({ id: true, createdAt: true });
export type InsertMechanic = z.infer<typeof insertMechanicSchema>;
export type Mechanic = typeof mechanicsTable.$inferSelect;

export const carsTable = pgTable("cars", {
  id: serial("id").primaryKey(),
  mechanicId: integer("mechanic_id").references(() => mechanicsTable.id, { onDelete: "set null" }),
  linkedMechanicId: integer("linked_mechanic_id").references(() => mechanicsTable.id, { onDelete: "set null" }),
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
  carType: text("car_type").notNull().default("dealer"),
  vehicleType: text("vehicle_type").notNull().default("car"),
  vehicleSubtype: text("vehicle_subtype"),
  owner: text("owner"),
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
  hours: numeric("hours"),
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

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => mechanicsTable.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").notNull().references(() => mechanicsTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Message = typeof messagesTable.$inferSelect;

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: integer("created_by").notNull().references(() => mechanicsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Group = typeof groupsTable.$inferSelect;

export const groupMembersTable = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  mechanicId: integer("mechanic_id").notNull().references(() => mechanicsTable.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export type GroupMember = typeof groupMembersTable.$inferSelect;

export const groupMessagesTable = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => mechanicsTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GroupMessage = typeof groupMessagesTable.$inferSelect;

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  mechanicId: integer("mechanic_id").notNull().references(() => mechanicsTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;

export const vehicleNotificationsTable = pgTable("vehicle_notifications", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull().references(() => mechanicsTable.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => mechanicsTable.id, { onDelete: "set null" }),
  carId: integer("car_id").notNull().references(() => carsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VehicleNotification = typeof vehicleNotificationsTable.$inferSelect;
