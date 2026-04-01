import { Router } from "express";
import { db, mechanicsTable, groupsTable, groupMembersTable, groupMessagesTable } from "@workspace/db";
import { eq, and, desc, sql, inArray, gt } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function getMechanicId(req: Request): number | null {
  const raw = req.headers["x-mechanic-id"];
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

// GET /api/groups — list all groups I belong to with last message + unread count
router.get("/groups", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    const memberships = await db
      .select({
        groupId: groupMembersTable.groupId,
        lastReadAt: groupMembersTable.lastReadAt,
      })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.mechanicId, me));

    if (memberships.length === 0) { res.json([]); return; }

    const groupIds = memberships.map(m => m.groupId);
    const readMap = new Map(memberships.map(m => [m.groupId, m.lastReadAt]));

    const groups = await db
      .select()
      .from(groupsTable)
      .where(inArray(groupsTable.id, groupIds));

    const result = await Promise.all(groups.map(async g => {
      const [lastMsg] = await db
        .select({ body: groupMessagesTable.body, createdAt: groupMessagesTable.createdAt, senderId: groupMessagesTable.senderId })
        .from(groupMessagesTable)
        .where(eq(groupMessagesTable.groupId, g.id))
        .orderBy(desc(groupMessagesTable.createdAt))
        .limit(1);

      const lastRead = readMap.get(g.id);
      const [unreadRow] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(groupMessagesTable)
        .where(
          and(
            eq(groupMessagesTable.groupId, g.id),
            lastRead ? gt(groupMessagesTable.createdAt, lastRead) : sql`true`,
          )
        );

      const memberRows = await db
        .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName })
        .from(groupMembersTable)
        .innerJoin(mechanicsTable, eq(groupMembersTable.mechanicId, mechanicsTable.id))
        .where(eq(groupMembersTable.groupId, g.id));

      return {
        id: g.id,
        name: g.name,
        createdBy: g.createdBy,
        createdAt: g.createdAt,
        lastMessageBody: lastMsg?.body ?? null,
        lastMessageAt: lastMsg?.createdAt ?? g.createdAt,
        lastSenderId: lastMsg?.senderId ?? null,
        unreadCount: lastRead === null ? (unreadRow?.count ?? 0) : (unreadRow?.count ?? 0),
        members: memberRows,
      };
    }));

    result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to load groups." });
  }
});

// GET /api/groups/unread-count — total unread group messages for badge
router.get("/groups/unread-count", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  try {
    const memberships = await db
      .select({ groupId: groupMembersTable.groupId, lastReadAt: groupMembersTable.lastReadAt })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.mechanicId, me));

    let total = 0;
    for (const m of memberships) {
      const [row] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(groupMessagesTable)
        .where(
          and(
            eq(groupMessagesTable.groupId, m.groupId),
            m.lastReadAt ? gt(groupMessagesTable.createdAt, m.lastReadAt) : sql`true`,
          )
        );
      total += row?.count ?? 0;
    }
    res.json({ count: total });
  } catch {
    res.status(500).json({ error: "Failed to fetch unread count." });
  }
});

// POST /api/groups — create a new group
router.post("/groups", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const { name, memberIds } = req.body as { name?: string; memberIds?: number[] };
  if (!name?.trim()) { res.status(400).json({ error: "Group name is required." }); return; }
  if (!Array.isArray(memberIds) || memberIds.length < 1) {
    res.status(400).json({ error: "At least one other member is required." }); return;
  }

  try {
    const [group] = await db
      .insert(groupsTable)
      .values({ name: name.trim(), createdBy: me })
      .returning();

    const allMembers = Array.from(new Set([me, ...memberIds]));
    await db.insert(groupMembersTable).values(
      allMembers.map(mechanicId => ({ groupId: group.id, mechanicId }))
    );

    res.status(201).json(group);
  } catch {
    res.status(500).json({ error: "Failed to create group." });
  }
});

// GET /api/groups/:groupId/messages — get thread
router.get("/groups/:groupId/messages", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const groupId = parseInt(req.params.groupId, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID." }); return; }

  try {
    const [membership] = await db
      .select()
      .from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.mechanicId, me)));
    if (!membership) { res.status(403).json({ error: "Not a member of this group." }); return; }

    const messages = await db
      .select({
        id: groupMessagesTable.id,
        groupId: groupMessagesTable.groupId,
        senderId: groupMessagesTable.senderId,
        senderName: mechanicsTable.displayName,
        body: groupMessagesTable.body,
        createdAt: groupMessagesTable.createdAt,
      })
      .from(groupMessagesTable)
      .innerJoin(mechanicsTable, eq(groupMessagesTable.senderId, mechanicsTable.id))
      .where(eq(groupMessagesTable.groupId, groupId))
      .orderBy(groupMessagesTable.createdAt);

    res.json(messages);
  } catch {
    res.status(500).json({ error: "Failed to load group messages." });
  }
});

// POST /api/groups/:groupId/messages — send to group
router.post("/groups/:groupId/messages", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const groupId = parseInt(req.params.groupId, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID." }); return; }

  const { body } = req.body as { body?: string };
  if (!body?.trim()) { res.status(400).json({ error: "Message body is required." }); return; }

  try {
    const [membership] = await db
      .select()
      .from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.mechanicId, me)));
    if (!membership) { res.status(403).json({ error: "Not a member of this group." }); return; }

    const [msg] = await db
      .insert(groupMessagesTable)
      .values({ groupId, senderId: me, body: body.trim() })
      .returning();

    res.status(201).json(msg);
  } catch {
    res.status(500).json({ error: "Failed to send message." });
  }
});

// POST /api/groups/:groupId/read — mark group as read for me
router.post("/groups/:groupId/read", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const groupId = parseInt(req.params.groupId, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID." }); return; }

  try {
    await db
      .update(groupMembersTable)
      .set({ lastReadAt: new Date() })
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.mechanicId, me)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark as read." });
  }
});

// DELETE /api/groups/:groupId/leave — leave (or delete if last member / creator)
router.delete("/groups/:groupId/leave", async (req, res) => {
  const me = getMechanicId(req);
  if (!me) { res.status(401).json({ error: "Not authenticated." }); return; }

  const groupId = parseInt(req.params.groupId, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID." }); return; }

  try {
    await db
      .delete(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.mechanicId, me)));

    const remaining = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));

    if ((remaining[0]?.count ?? 0) === 0) {
      await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to leave group." });
  }
});

export default router;
