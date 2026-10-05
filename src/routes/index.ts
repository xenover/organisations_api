import organisationRoutes from "./organisations.js";
import type { Express } from "express";

const appRouter = (app: Express): void => {
	app.get("/", (_req, res) => {
		res.send("Nothing here");
	});

	organisationRoutes(app);
};

export default appRouter;
