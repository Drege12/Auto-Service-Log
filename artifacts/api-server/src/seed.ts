import bcrypt from "bcryptjs";
import { db, mechanicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function seedAdminAccount() {
  try {
    // Only seed if NO admin account exists at all — not just if "admin" username is missing.
    // This prevents the default account from being recreated after a deliberate deletion.
    const [existing] = await db
      .select({ id: mechanicsTable.id })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.isAdmin, 1));

    if (existing) return;

    const passwordHash = await bcrypt.hash("admin", 10);
    await db.insert(mechanicsTable).values({
      username: "admin",
      passwordHash,
      displayName: "Admin",
      isAdmin: 1,
    });

    console.log("[seed] Default admin account created (no admins existed).");
  } catch (err) {
    console.error("[seed] Failed to seed admin account:", err);
  }
}
