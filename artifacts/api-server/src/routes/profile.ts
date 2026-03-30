import { Router } from "express";
import { db, mechanicsTable, carsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function getMechanicId(req: Request): number | null {
  const raw = req.headers["x-mechanic-id"];
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

// GET /api/profile — own profile + contact info
router.get("/profile", async (req, res) => {
  const mechanicId = getMechanicId(req);
  if (!mechanicId) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    const [m] = await db
      .select({
        id: mechanicsTable.id,
        username: mechanicsTable.username,
        displayName: mechanicsTable.displayName,
        isAdmin: mechanicsTable.isAdmin,
        phone: mechanicsTable.phone,
        email: mechanicsTable.email,
        contactPublic: mechanicsTable.contactPublic,
      })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, mechanicId));

    if (!m) { res.status(404).json({ error: "Account not found." }); return; }
    res.json({ ...m, contactPublic: m.contactPublic === 1 });
  } catch {
    res.status(500).json({ error: "Failed to load profile." });
  }
});

// PATCH /api/profile — update own contact info + privacy
router.patch("/profile", async (req, res) => {
  const mechanicId = getMechanicId(req);
  if (!mechanicId) { res.status(401).json({ error: "Not authenticated." }); return; }

  const { phone, email, contactPublic } = req.body as {
    phone?: string;
    email?: string;
    contactPublic?: boolean;
  };

  try {
    const setValues: { phone?: string | null; email?: string | null; contactPublic?: number } = {};
    if (phone !== undefined) setValues.phone = phone.trim() || null;
    if (email !== undefined) setValues.email = email.trim() || null;
    if (contactPublic !== undefined) setValues.contactPublic = contactPublic ? 1 : 0;

    if (Object.keys(setValues).length === 0) {
      res.status(400).json({ error: "Nothing to update." }); return;
    }

    const [updated] = await db
      .update(mechanicsTable)
      .set(setValues)
      .where(eq(mechanicsTable.id, mechanicId))
      .returning({
        id: mechanicsTable.id,
        username: mechanicsTable.username,
        displayName: mechanicsTable.displayName,
        isAdmin: mechanicsTable.isAdmin,
        phone: mechanicsTable.phone,
        email: mechanicsTable.email,
        contactPublic: mechanicsTable.contactPublic,
      });

    if (!updated) { res.status(404).json({ error: "Account not found." }); return; }
    res.json({ ...updated, contactPublic: updated.contactPublic === 1 });
  } catch {
    res.status(500).json({ error: "Failed to save profile." });
  }
});

// GET /api/mechanics/:id/contact — contact info for a specific mechanic
// Returns full contact if: requester is the mechanic, requester is admin, or contact is public
router.get("/mechanics/:id/contact", async (req, res) => {
  const requesterId = getMechanicId(req);
  if (!requesterId) { res.status(401).json({ error: "Not authenticated." }); return; }

  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid mechanic ID." }); return; }

  try {
    const [requester] = await db
      .select({ isAdmin: mechanicsTable.isAdmin })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, requesterId));

    const [target] = await db
      .select({
        id: mechanicsTable.id,
        displayName: mechanicsTable.displayName,
        phone: mechanicsTable.phone,
        email: mechanicsTable.email,
        contactPublic: mechanicsTable.contactPublic,
      })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, targetId));

    if (!target) { res.status(404).json({ error: "Mechanic not found." }); return; }

    const isSelf = requesterId === targetId;
    const isAdmin = requester?.isAdmin === 1;
    const isPublic = target.contactPublic === 1;

    if (isSelf || isAdmin || isPublic) {
      res.json({
        id: target.id,
        displayName: target.displayName,
        phone: target.phone,
        email: target.email,
        contactPublic: target.contactPublic === 1,
        visible: true,
      });
    } else {
      res.json({
        id: target.id,
        displayName: target.displayName,
        phone: null,
        email: null,
        contactPublic: false,
        visible: false,
      });
    }
  } catch {
    res.status(500).json({ error: "Failed to load contact info." });
  }
});

export default router;
