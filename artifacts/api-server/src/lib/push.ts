import webpush from "web-push";
import { db, pushSubscriptionsTable, mechanicsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:admin@example.com";
  if (!pub || !priv) return;
  webpush.setVapidDetails(email, pub, priv);
  configured = true;
}

export async function sendPushToMechanic(mechanicId: number, payload: object): Promise<void> {
  ensureConfigured();
  if (!configured) return;

  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.mechanicId, mechanicId));

    const json = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
        ).catch(async err => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
          }
        })
      )
    );
  } catch { /* never break callers */ }
}

export async function sendPushToMechanics(mechanicIds: number[], payload: object): Promise<void> {
  if (mechanicIds.length === 0) return;
  await Promise.allSettled(mechanicIds.map(id => sendPushToMechanic(id, payload)));
}

export { configured as vapidConfigured };
