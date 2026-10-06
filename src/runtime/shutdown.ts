import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Knex } from "knex";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function registerShutdown(server: Server, database: Knex): void {
  let stopping = false;
  const trackResponse = (
    _request: IncomingMessage,
    response: ServerResponse,
  ) => {
    response.once("finish", () => {
      // A request active at server.close() can become an idle keep-alive socket later.
      if (stopping) queueMicrotask(() => server.closeIdleConnections());
    });
  };
  server.prependListener("request", trackResponse);
  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    logger.info(
      { signal, timeoutMs: env.SHUTDOWN_TIMEOUT_MS },
      "Shutdown started",
    );
    const deadline = setTimeout(() => {
      logger.error({ signal }, "Shutdown timed out");
      server.closeAllConnections();
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await database.destroy();
      logger.info({ signal }, "Shutdown completed");
    } catch (err) {
      logger.error({ err, signal }, "Shutdown failed");
      server.closeAllConnections();
      process.exit(1);
    } finally {
      clearTimeout(deadline);
      process.off("SIGTERM", onTerm);
      process.off("SIGINT", onInt);
      server.off("request", trackResponse);
    }
  };
  const onTerm = () => void shutdown("SIGTERM");
  const onInt = () => void shutdown("SIGINT");
  process.on("SIGTERM", onTerm);
  process.on("SIGINT", onInt);
}
