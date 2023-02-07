const service = require("../services/organisations");

const organisationRoutes = (app) => {
	app.get("/organisations", async (req, res) => {
		const { name, page } = req.query;
		const rows = await service.get(name, page);
		res.status(200);
		res.send(rows);
	});

	app.post("/organisations", async (req, res) => {
		await service.insert(req.body);
		res.status(201);
		res.send("OK");
	});
};

module.exports = organisationRoutes;
