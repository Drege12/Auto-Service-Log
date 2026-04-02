import { Router } from "express";
import { db, mechanicsTable, messagesTable } from "@workspace/db";
import { eq, or, and, desc, sql, isNull, inArray } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function getMechanicId(req: Request): number | null {
  const raw = req.headers["x-mechanic-id"];
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

// GET /api/messages/inbox — list of conversations with unread count + last message
router.get("/messages/inbox", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    // All messages involving me
    const rows = await db
      .select({
        id: messagesTable.id,
        senderId: messagesTable.senderId,
        recipientId: messagesTable.recipientId,
        body: messagesTable.body,
        readAt: messagesTable.readAt,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(
        or(
          eq(messagesTable.senderId, me),
          eq(messagesTable.recipientId, me),
        )
      )
      .orderBy(desc(messagesTable.createdAt));

    // Group into conversations keyed by the other person's ID
    const convMap = new Map<number, {
      partnerId: number;
      lastMessageBody: string;
      lastMessageAt: Date;
      unreadCount: number;
      lastSenderId: number;
    }>();

    for (const row of rows) {
      const partnerId = row.senderId === me ? row.recipientId : row.senderId;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, {
          partnerId,
          lastMessageBody: row.body,
          lastMessageAt: row.createdAt,
          unreadCount: 0,
          lastSenderId: row.senderId,
        });
      }
      // Count unread messages from partner to me
      if (row.recipientId === me && row.senderId !== me && !row.readAt) {
        convMap.get(partnerId)!.unreadCount++;
      }
    }

    if (convMap.size === 0) {
      res.json([]);
      return;
    }

    // Fetch display names for all partners
    const partnerIds = Array.from(convMap.keys());
    const mechanics = await db
      .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName })
      .from(mechanicsTable)
      .where(inArray(mechanicsTable.id, partnerIds));

    const nameMap = new Map(mechanics.map(m => [m.id, m.displayName]));

    const conversations = Array.from(convMap.values())
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
      .map(c => ({
        partnerId: c.partnerId,
        partnerName: nameMap.get(c.partnerId) ?? "Unknown",
        lastMessageBody: c.lastMessageBody,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
        lastSenderId: c.lastSenderId,
      }));

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "Failed to load inbox." });
  }
});

// GET /api/messages/unread-count — total unread DMs for badge (groups counted separately)
router.get("/messages/unread-count", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    const [row] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.recipientId, me),
          isNull(messagesTable.readAt),
        )
      );
    res.json({ count: row?.count ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to fetch unread count." });
  }
});

// GET /api/messages/thread/:partnerId — full thread between me and another mechanic
router.get("/messages/thread/:partnerId", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const partnerId = parseInt(req.params.partnerId, 10);
  if (isNaN(partnerId)) { res.status(400).json({ error: "Invalid partner ID." }); return; }

  try {
    const rows = await db
      .select()
      .from(messagesTable)
      .where(
        or(
          and(eq(messagesTable.senderId, me), eq(messagesTable.recipientId, partnerId)),
          and(eq(messagesTable.senderId, partnerId), eq(messagesTable.recipientId, me)),
        )
      )
      .orderBy(messagesTable.createdAt);

    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to load thread." });
  }
});

// POST /api/messages — send a message
router.post("/messages", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const { recipientId, body } = req.body as { recipientId?: number; body?: string };
  if (!recipientId || isNaN(recipientId)) { res.status(400).json({ error: "recipientId is required." }); return; }
  if (!body?.trim()) { res.status(400).json({ error: "Message body is required." }); return; }
  if (recipientId === me) { res.status(400).json({ error: "Cannot message yourself." }); return; }

  try {
    const [msg] = await db
      .insert(messagesTable)
      .values({ senderId: me, recipientId, body: body.trim() })
      .returning();

    // Push notification to recipient — fire and forget
    const senderRow = await db.select({ displayName: mechanicsTable.displayName }).from(mechanicsTable).where(eq(mechanicsTable.id, me)).limit(1);
    const senderName = senderRow[0]?.displayName ?? "Someone";
    import("../lib/push").then(({ sendPushToMechanic }) =>
      sendPushToMechanic(recipientId, {
        type: "dm",
        title: senderName,
        body: body.trim().slice(0, 120),
        url: "messages",
      })
    ).catch(() => {});

    res.status(201).json(msg);
  } catch {
    res.status(500).json({ error: "Failed to send message." });
  }
});

// POST /api/messages/read/:partnerId — mark all messages from partner as read
router.post("/messages/read/:partnerId", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const partnerId = parseInt(req.params.partnerId, 10);
  if (isNaN(partnerId)) { res.status(400).json({ error: "Invalid partner ID." }); return; }

  try {
    await db
      .update(messagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messagesTable.senderId, partnerId),
          eq(messagesTable.recipientId, me),
          isNull(messagesTable.readAt),
        )
      );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark as read." });
  }
});

// DELETE /api/messages/conversation/:partnerId — delete all messages in a thread
router.delete("/messages/conversation/:partnerId", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const partnerId = parseInt(req.params.partnerId, 10);
  if (isNaN(partnerId)) { res.status(400).json({ error: "Invalid partner ID." }); return; }

  try {
    await db
      .delete(messagesTable)
      .where(
        or(
          and(eq(messagesTable.senderId, me), eq(messagesTable.recipientId, partnerId)),
          and(eq(messagesTable.senderId, partnerId), eq(messagesTable.recipientId, me)),
        )
      );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete conversation." });
  }
});

// GET /api/mechanics/list — list all non-admin mechanics (for new conversation)
router.get("/mechanics/list", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    const rows = await db
      .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName, username: mechanicsTable.username })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.isAdmin, 0))
      .orderBy(mechanicsTable.displayName);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to list mechanics." });
  }
});

export default router;
