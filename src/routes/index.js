import organisationRoutes from "./organisations.js";

const appRouter = (app) => {
	app.get("/", (req, res) => {
		res.send("Nothing here");
	});

	organisationRoutes(app);
};

export default appRouter;
