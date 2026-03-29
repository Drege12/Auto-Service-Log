import app from "./app";
import { logger } from "./lib/logger";
import { seedAdminAccount } from "./seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedAdminAccount().then(() => {
  app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
});
