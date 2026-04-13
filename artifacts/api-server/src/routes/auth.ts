import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, mechanicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, verifyToken, extractBearerToken } from "../lib/jwt";
import { emailConfigured, sendForgotPasswordEmail } from "../lib/email";

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

    const token = signToken(mechanic.id);
    res.status(201).json({ ok: true, mechanicId: mechanic.id, username: mechanic.username, displayName: mechanic.displayName, role: mechanic.role ?? "mechanic", token });
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

    const token = signToken(mechanic.id);
    res.json({ ok: true, mechanicId: mechanic.id, username: mechanic.username, displayName: mechanic.displayName, isAdmin: mechanic.isAdmin === 1, role: mechanic.role ?? "mechanic", token });
  } catch (err) {
    res.status(500).json({ error: "Login failed." });
  }
});

router.get("/auth/me", async (req, res) => {
  const token = extractBearerToken(req.headers["authorization"]);
  if (!token) {
    res.status(401).json({ error: "No token provided." });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
    return;
  }

  try {
    const [mechanic] = await db.select({
      id: mechanicsTable.id,
      username: mechanicsTable.username,
      displayName: mechanicsTable.displayName,
      isAdmin: mechanicsTable.isAdmin,
      role: mechanicsTable.role,
    }).from(mechanicsTable).where(eq(mechanicsTable.id, payload.mechanicId));

    if (!mechanic) {
      res.status(401).json({ error: "Account not found. Please sign in again." });
      return;
    }

    res.json({ ok: true, mechanicId: mechanic.id, username: mechanic.username, displayName: mechanic.displayName, isAdmin: mechanic.isAdmin === 1, role: mechanic.role ?? "mechanic" });
  } catch {
    res.status(500).json({ error: "Session check failed." });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !email.trim()) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  if (!emailConfigured) {
    res.status(503).json({ error: "Email service is not configured on this server." });
    return;
  }

  try {
    const [mechanic] = await db
      .select({ id: mechanicsTable.id, username: mechanicsTable.username, email: mechanicsTable.email })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.email, email.trim().toLowerCase()));

    if (!mechanic || !mechanic.email) {
      res.json({ ok: true });
      return;
    }

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await db.update(mechanicsTable).set({ passwordHash }).where(eq(mechanicsTable.id, mechanic.id));

    await sendForgotPasswordEmail({
      to: mechanic.email,
      username: mechanic.username,
      tempPassword,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Something went wrong. Try again." });
  }
});

export default router;
