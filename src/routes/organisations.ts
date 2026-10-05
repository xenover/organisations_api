import * as service from "../services/organisations.js";
import type { Express } from "express";
import type {
	OrganisationInput,
	OrganisationQuery,
	OrganisationRelationship,
} from "../types/organisations.js";

const organisationRoutes = (app: Express): void => {
	app.get<Record<string, never>, OrganisationRelationship[], never, OrganisationQuery>("/organisations", async (req, res) => {
		const { name, page } = req.query;
		const rows = await service.get(name, page === undefined ? 1 : Number(page));
		res.status(200);
		res.send(rows);
	});

	app.post<Record<string, never>, string, OrganisationInput>("/organisations", async (req, res) => {
		await service.insert(req.body);
		res.status(201);
		res.send("OK");
	});
};

export default organisationRoutes;
