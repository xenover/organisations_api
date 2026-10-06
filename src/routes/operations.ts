import type { Express } from "express";
import database from "../database/db.js";

export default function operationRoutes(app: Express): void {
  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Liveness (independent of SQLite)
   *     responses:
   *       '200':
   *         description: The HTTP application is running
   *         content:
   *           application/json:
   *             schema: { type: object, required: [status], properties: { status: { type: string, enum: [ok] } } }
   *             example: { status: ok }
   */
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  /**
   * @openapi
   * /ready:
   *   get:
   *     summary: Readiness (SQLite and the organisation schema)
   *     responses:
   *       '200':
   *         description: SQLite can read the required application tables and columns
   *         content:
   *           application/json:
   *             schema: { type: object, required: [status], properties: { status: { type: string, enum: [ready] } } }
   *             example: { status: ready }
   *       '503':
   *         description: SQLite or the required schema is unavailable
   *         content:
   *           application/json:
   *             schema: { type: object, required: [status], properties: { status: { type: string, enum: [not_ready] } } }
   *             example: { status: not_ready }
   */
  app.get("/ready", async (_req, res) => {
    try {
      await database("organisations")
        .select("id", "name")
        .limit(1)
        .timeout(1000);
      await database("relationships")
        .select("parent_id", "child_id")
        .limit(1)
        .timeout(1000);
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not_ready" });
    }
  });
}
