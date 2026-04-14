import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, mechanicsTable, abuseReportsTable, messagesTable } from "@workspace/db";

const router = Router();

function getMechanicId(req: { headers: Record<string, string | string[] | undefined> }): number | null {
  const raw = req.headers["x-mechanic-id"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(val ?? "", 10);
  return isNaN(id) ? null : id;
}

// POST /api/abuse-reports
// Body: { reportedId: number, carId?: number, reason?: string }
router.post("/abuse-reports", async (req, res) => {
  try {
    const reporterId = getMechanicId(req);
    if (!reporterId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { reportedId, carId, reason } = req.body as {
      reportedId?: number;
      carId?: number;
      reason?: string;
    };

    if (!reportedId || isNaN(Number(reportedId))) {
      res.status(400).json({ error: "reportedId is required" });
      return;
    }

    // Fetch reporter and reported names for the admin message
    const [reporter] = await db
      .select({ displayName: mechanicsTable.displayName, username: mechanicsTable.username })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, reporterId));

    const [reported] = await db
      .select({ displayName: mechanicsTable.displayName, username: mechanicsTable.username })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.id, Number(reportedId)));

    if (!reporter || !reported) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Persist the report
    await db.insert(abuseReportsTable).values({
      reporterId,
      reportedId: Number(reportedId),
      carId: carId ? Number(carId) : null,
      reason: reason?.trim() || null,
    });

    // Build the admin message body
    const reasonLine = reason?.trim() ? `\n\nReason: ${reason.trim()}` : "";
    const carLine = carId ? `\nVehicle ID: #${carId}` : "";
    const body =
      `[ABUSE REPORT]\nReporter: ${reporter.displayName} (@${reporter.username})\nReported: ${reported.displayName} (@${reported.username})${carLine}${reasonLine}`;

    // Find all admins and notify them
    const admins = await db
      .select({ id: mechanicsTable.id })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.isAdmin, 1));

    await Promise.all(
      admins.map(async (admin) => {
        // Send as a DM from the reporter to the admin
        await db.insert(messagesTable).values({
          senderId: reporterId,
          recipientId: admin.id,
          body,
        });

        // Send push notification if available
        try {
          const { sendPushToMechanic } = await import("../lib/push");
          await sendPushToMechanic(admin.id, {
            title: "Abuse Report Filed",
            body: `${reporter.displayName} reported ${reported.displayName}`,
            url: "/messages",
          });
        } catch {
          // push not configured — ignore
        }
      })
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to submit report" });
  }
});

export default router;
