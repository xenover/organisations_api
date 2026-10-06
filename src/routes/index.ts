import organisationRoutes from "./organisations.js";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "../docs/openapi.js";

const appRouter = (app: Express): void => {
  /**
   * @openapi
   * /:
   *   get:
   *     summary: API information
   *     responses:
   *       '200':
   *         description: API name and documentation URL
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     name: { type: string }
   *                     documentation: { type: string }
   *             example: { data: { name: Organisations API, documentation: /swagger } }
   */
  app.get("/", (_req, res) => {
    res.json({
      data: { name: "Organisations API", documentation: "/swagger" },
    });
  });
  /**
   * @openapi
   * /swagger.json:
   *   get:
   *     summary: OpenAPI specification
   *     responses:
   *       '200':
   *         description: The OpenAPI 3.0.3 document
   *         content:
   *           application/json:
   *             schema: { type: object }
   *             example: { openapi: 3.0.3, info: { title: Organisations API, version: 1.0.0 }, paths: {} }
   */
  app.get("/swagger.json", (_req, res) => res.json(openApiDocument));
  /**
   * @openapi
   * /swagger:
   *   get:
   *     summary: Interactive Swagger UI (redirects to /swagger/)
   *     responses:
   *       '301':
   *         description: Redirect to the documentation with a trailing slash
   *         headers:
   *           Location: { schema: { type: string }, example: /swagger/ }
   * /swagger/:
   *   get:
   *     summary: Interactive Swagger UI
   *     responses:
   *       '200':
   *         description: Swagger UI with locally served assets
   *         content:
   *           text/html:
   *             schema: { type: string }
   *             example: '<!DOCTYPE html><html>Swagger UI</html>'
   */
  app.use(
    "/swagger",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: "/swagger.json", validatorUrl: null },
    }),
  );
  organisationRoutes(app);
};

export default appRouter;
