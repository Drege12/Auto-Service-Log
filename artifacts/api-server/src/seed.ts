import bcrypt from "bcryptjs";
import { db, mechanicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function seedAdminAccount() {
  try {
    const [existing] = await db
      .select({ id: mechanicsTable.id })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.username, "admin"));

    if (existing) return;

    const passwordHash = await bcrypt.hash("admin", 10);
    await db.insert(mechanicsTable).values({
      username: "admin",
      passwordHash,
      displayName: "Admin",
      isAdmin: 1,
    });

    console.log("[seed] Admin account created.");
  } catch (err) {
    console.error("[seed] Failed to seed admin account:", err);
  }
}
