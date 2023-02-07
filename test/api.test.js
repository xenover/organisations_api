process.env.NODE_ENV = "test";

const request = require("supertest");
const assert = require("assert");

const config = require("../knexfile.js")[process.env.NODE_ENV];
const knex = require("knex")(config);

const server = require("../server");

describe("Organisations", () => {
	before(async function () {
		await knex.migrate.up();
	});

	after(async function () {
		await knex("relationships")
			.del()
			.then(() => {
				knex("organistions").del();
			});
	});

	describe("relationships handling", () => {
		it("it should return the correct relationships for an org", async () => {
			const inputJson = {
				org_name: "Parent1",
				daughters: [
					{
						org_name: "Child1",
						daughters: [
							{
								org_name: "GrandChild1",
							},
						],
					},
					{
						org_name: "Child2",
						daughters: [
							{
								org_name: "GrandChild3",
							},
							{
								org_name: "GrandChild4",
								daughters: [
									{
										org_name: "GreatGrandChild1",
									},
								],
							},
						],
					},
				],
			};
			const expectedJson = [
				{
					org_name: "Child2",
					relationship_type: "parent",
				},
				{
					org_name: "GrandChild3",
					relationship_type: "sister",
				},
				{
					org_name: "GreatGrandChild1",
					relationship_type: "daughter",
				},
			];

			// POST organisations
			await request(server)
				.post("/organisations")
				.send(inputJson)
				.expect(201);
			// GET organisations
			await request(server)
				.get("/organisations")
				.query({ name: "GrandChild4" })
				.expect(200)
				.then((response) => assert(response.body, expectedJson));
		});
	});
});
