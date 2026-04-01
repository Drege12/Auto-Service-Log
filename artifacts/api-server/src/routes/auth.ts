import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, mechanicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const { username, password, displayName, role } = req.body as {
    username?: string;
    password?: string;
    displayName?: string;
    role?: string;
  };

  if (!username || !username.trim()) {
    res.status(400).json({ error: "Username is required." });
    return;
  }
  if (!password || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters." });
    return;
  }
  if (!displayName || !displayName.trim()) {
    res.status(400).json({ error: "Display name is required." });
    return;
  }

  try {
    const [existing] = await db.select({ id: mechanicsTable.id })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.username, username.trim().toLowerCase()));
    if (existing) {
      res.status(409).json({ error: "Username already taken." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [mechanic] = await db.insert(mechanicsTable).values({
      username: username.trim().toLowerCase(),
      passwordHash,
      displayName: displayName.trim(),
      role: role === "driver" ? "driver" : "mechanic",
    }).returning({ id: mechanicsTable.id, username: mechanicsTable.username, displayName: mechanicsTable.displayName, role: mechanicsTable.role });

    res.status(201).json({ ok: true, mechanicId: mechanic.id, username: mechanic.username, displayName: mechanic.displayName, role: mechanic.role ?? "mechanic" });
  } catch (err) {
    res.status(500).json({ error: "Failed to create account." });
  }
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  try {
    const [mechanic] = await db.select()
      .from(mechanicsTable)
      .where(eq(mechanicsTable.username, username.trim().toLowerCase()));

    if (!mechanic) {
      res.status(401).json({ error: "Incorrect username or password." });
      return;
    }

    const match = await bcrypt.compare(password, mechanic.passwordHash);
    if (!match) {
      res.status(401).json({ error: "Incorrect username or password." });
      return;
    }

    res.json({ ok: true, mechanicId: mechanic.id, username: mechanic.username, displayName: mechanic.displayName, isAdmin: mechanic.isAdmin === 1, role: mechanic.role ?? "mechanic" });
  } catch (err) {
    res.status(500).json({ error: "Login failed." });
  }
});

export default router;
