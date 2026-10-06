import createApp from "./src/app.js";
import type { Server } from "node:http";
import { env } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";
import database from "./src/database/db.js";
import { registerShutdown } from "./src/runtime/shutdown.js";

const app = createApp();
const server: Server = app.listen(env.PORT, () => {
  const address = server.address();
  if (address && typeof address !== "string") {
    logger.info({ port: address.port }, "Server started up");
  }
});
registerShutdown(server, database);

export default server;
