process.env.NODE_ENV = "test";

const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../server");

require("chai").should();

const config = require("../knexfile.js")[process.env.NODE_ENV];
const knex = require("knex")(config);

chai.use(chaiHttp);

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
		it("it should return the correct relationships for an org", (done) => {
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
			chai.request(server)
				.post("/organisations")
				.send(inputJson)
				.end((err, res) => {
					res.should.have.status(201);
				});
			// Wait 1 second for the POST to finish before querying
			setTimeout(function () {
				// GET organisations
				chai.request(server)
					.get("/organisations")
					.query({ name: "GrandChild4" })
					.end((err, res) => {
						res.should.have.status(200);
						res.body.should.deep.equal(expectedJson);
						done();
					});
			}, 1000);
		});
	});
});
