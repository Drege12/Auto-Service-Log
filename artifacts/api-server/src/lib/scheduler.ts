import cron from "node-cron";
import { db, mechanicsTable, carsTable, pushSubscriptionsTable } from "@workspace/db";
import { eq, and, inArray, or } from "drizzle-orm";
import { sendPushToMechanic } from "./push";

export async function sendMonthlyMileageReminders() {
  try {
    const drivers = await db
      .select({ id: mechanicsTable.id, displayName: mechanicsTable.displayName })
      .from(mechanicsTable)
      .where(eq(mechanicsTable.role, "driver"));

    if (drivers.length === 0) return;

    const driverIds = drivers.map(d => d.id);

    const subscribed = await db
      .selectDistinct({ mechanicId: pushSubscriptionsTable.mechanicId })
      .from(pushSubscriptionsTable)
      .where(inArray(pushSubscriptionsTable.mechanicId, driverIds));
    const subscribedSet = new Set(subscribed.map(s => s.mechanicId));

    for (const driver of drivers) {
      if (!subscribedSet.has(driver.id)) continue;

      const cars = await db
        .select({ id: carsTable.id, year: carsTable.year, make: carsTable.make, model: carsTable.model })
        .from(carsTable)
        .where(and(
          eq(carsTable.sold, 0),
          or(
            eq(carsTable.linkedMechanicId, driver.id),
            eq(carsTable.mechanicId, driver.id),
          )
        ));

      if (cars.length === 0) continue;

      for (const car of cars) {
        const label = `${car.year} ${car.make} ${car.model}`;
        await sendPushToMechanic(driver.id, {
          title: "Mileage Reminder",
          body: `Time to log your mileage for your ${label}.`,
          url: `cars/${car.id}`,
        });
      }
    }
  } catch (err) {
    console.error("[scheduler] Monthly mileage reminder failed:", err);
  }
}

export function startScheduler() {
  cron.schedule("0 9 1 * *", () => {
    sendMonthlyMileageReminders();
  }, { timezone: "America/Chicago" });
}
