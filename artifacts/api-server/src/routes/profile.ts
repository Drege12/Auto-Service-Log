import { Router } from "express";
import { db, mechanicsTable, carsTable } from "@workspace/db";
import { eq, and, isNotNull, inArray, ne } from "drizzle-orm";
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
        role: mechanicsTable.role,
        phone: mechanicsTable.phone,
        email: mechanicsTable.email,
        contactPublic: mechanicsTable.contactPublic,
        shopCode: mechanicsTable.shopCode,
      })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, mechanicId));

    if (!m) { res.status(404).json({ error: "Account not found." }); return; }
    res.json({ ...m, contactPublic: m.contactPublic === 1 });
  } catch {
    res.status(500).json({ error: "Failed to load profile." });
  }
});

// PATCH /api/profile — update own contact info + privacy + shop code
router.patch("/profile", async (req, res) => {
  const mechanicId = getMechanicId(req);
  if (!mechanicId) { res.status(401).json({ error: "Not authenticated." }); return; }

  const { phone, email, contactPublic, shopCode } = req.body as {
    phone?: string;
    email?: string;
    contactPublic?: boolean;
    shopCode?: string;
  };

  try {
    const setValues: {
      phone?: string | null;
      email?: string | null;
      contactPublic?: number;
      shopCode?: string | null;
    } = {};
    if (phone !== undefined) setValues.phone = phone.trim() || null;
    if (email !== undefined) setValues.email = email.trim() || null;
    if (contactPublic !== undefined) setValues.contactPublic = contactPublic ? 1 : 0;
    if (shopCode !== undefined) setValues.shopCode = shopCode.trim().toUpperCase() || null;

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
        role: mechanicsTable.role,
        phone: mechanicsTable.phone,
        email: mechanicsTable.email,
        contactPublic: mechanicsTable.contactPublic,
        shopCode: mechanicsTable.shopCode,
      });

    if (!updated) { res.status(404).json({ error: "Account not found." }); return; }
    res.json({ ...updated, contactPublic: updated.contactPublic === 1 });
  } catch {
    res.status(500).json({ error: "Failed to save profile." });
  }
});

// GET /api/mechanics/suggestions — smart default + search for new messages
// Mechanics: defaults = clients (linked operators) + same-shop-code colleagues
// Operators/Drivers: defaults = their linked mechanics
// ?q=xxx searches all non-admin users
router.get("/mechanics/suggestions", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  try {
    const [caller] = await db
      .select({ role: mechanicsTable.role, shopCode: mechanicsTable.shopCode })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, me));

    if (!caller) { res.status(404).json({ error: "Not found." }); return; }

    type SuggestionUser = { id: number; displayName: string; username: string; tag: string };
    let defaults: SuggestionUser[] = [];

    if (caller.role === "mechanic") {
      // Clients = car owners whose vehicles I (the mechanic) am linked to service
      // Mechanic links → becomes linkedMechanicId; car owner is mechanicId
      const linkedRows = await db
        .select({ clientId: carsTable.mechanicId })
        .from(carsTable)
        .where(and(eq(carsTable.linkedMechanicId, me), isNotNull(carsTable.mechanicId)));

      const clientIds = [...new Set(linkedRows.map(r => r.clientId!))];
      if (clientIds.length > 0) {
        const clients = await db
          .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName, username: mechanicsTable.username })
          .from(mechanicsTable)
          .where(inArray(mechanicsTable.id, clientIds));
        defaults.push(...clients.map(c => ({ ...c, tag: "client" })));
      }

      // Shop colleagues = others with same shop code
      if (caller.shopCode) {
        const existingIds = new Set(defaults.map(d => d.id));
        existingIds.add(me);
        const colleagues = await db
          .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName, username: mechanicsTable.username })
          .from(mechanicsTable)
          .where(and(
            eq(mechanicsTable.shopCode, caller.shopCode),
            ne(mechanicsTable.id, me),
          ));
        defaults.push(...colleagues.filter(c => !existingIds.has(c.id)).map(c => ({ ...c, tag: "shop" })));
      }
    } else {
      // Operator/driver: I own the car (mechanicId = me); the mechanic linked to service it is linkedMechanicId
      const linkedRows = await db
        .select({ mechId: carsTable.linkedMechanicId })
        .from(carsTable)
        .where(and(eq(carsTable.mechanicId, me), isNotNull(carsTable.linkedMechanicId)));

      const mechIds = [...new Set(linkedRows.map(r => r.mechId!))];
      if (mechIds.length > 0) {
        const mechs = await db
          .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName, username: mechanicsTable.username })
          .from(mechanicsTable)
          .where(inArray(mechanicsTable.id, mechIds));
        defaults.push(...mechs.map(m => ({ ...m, tag: "mechanic" })));
      }
    }

    // Search results (all non-admin users, excluding self)
    let search: SuggestionUser[] = [];
    if (q) {
      const all = await db
        .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName, username: mechanicsTable.username })
        .from(mechanicsTable)
        .where(and(eq(mechanicsTable.isAdmin, 0), ne(mechanicsTable.id, me)));

      const ql = q.toLowerCase();
      search = all
        .filter(m => m.displayName.toLowerCase().includes(ql) || m.username.toLowerCase().includes(ql))
        .map(m => ({ ...m, tag: "result" }));
    }

    res.json({ defaults, search });
  } catch {
    res.status(500).json({ error: "Failed to load suggestions." });
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
