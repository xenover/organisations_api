import { expect } from "chai";
import knexModule from "knex";
import { after, before, beforeEach, describe, it } from "mocha";
import { up } from "../migrations/20200729152030_create_organisations_and_relationships.js";
import { OrganisationRepository } from "../src/repositories/organisations.js";
import { RelationshipRepository } from "../src/repositories/relationships.js";
import type {
  OrganisationRecord,
  OrganisationRelationship,
  RelationshipRecord,
} from "../src/types/organisations.js";

describe("Database repositories", () => {
  const database = knexModule.knex({
    client: "sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  const organisations = new OrganisationRepository(database);
  const relationships = new RelationshipRepository(database);

  before(async () => {
    await up(database);
  });

  beforeEach(async () => {
    await database("relationships").del();
    await database("organisations").del();
  });

  after(async () => {
    await database.destroy();
  });

  it("reuses exact names, preserving quotes and whitespace", async () => {
    const name = " Organisation's name ";
    const id = await organisations.findOrCreate(name);
    expect(await organisations.findOrCreate(name)).to.equal(id);
    const otherId = await organisations.findOrCreate(name.trim());
    expect(otherId).not.to.equal(id);
    expect(
      await database<OrganisationRecord>("organisations").orderBy("id"),
    ).to.deep.equal([
      { id, name },
      { id: otherId, name: name.trim() },
    ]);
  });

  it("reuses a link while allowing the same child under another parent", async () => {
    const parent = await organisations.findOrCreate("Parent");
    const otherParent = await organisations.findOrCreate("Other parent");
    const child = await organisations.findOrCreate("Child");
    await relationships.createIfMissing(child, parent);
    await relationships.createIfMissing(child, parent);
    await relationships.createIfMissing(child, otherParent);
    const rows = await database<RelationshipRecord>("relationships")
      .select("child_id", "parent_id")
      .orderBy("id");
    expect(rows).to.deep.equal([
      { child_id: child, parent_id: parent },
      { child_id: child, parent_id: otherParent },
    ]);
  });

  it("looks up sorted, deduplicated relationships with parameterized names", async () => {
    const name = "Target' OR 1=1 --";
    await database<OrganisationRecord>("organisations").insert([
      { id: 1, name: "A Parent" },
      { id: 2, name: "Z Parent" },
      { id: 3, name },
      { id: 4, name: "Sibling" },
      { id: 5, name: "Daughter" },
    ]);
    await database<RelationshipRecord>("relationships").insert([
      { child_id: 3, parent_id: 1 },
      { child_id: 3, parent_id: 2 },
      { child_id: 4, parent_id: 1 },
      { child_id: 4, parent_id: 2 },
      { child_id: 5, parent_id: 3 },
    ]);
    expect(await relationships.findByOrganisationName(name)).to.deep.equal([
      { org_name: "A Parent", relationship_type: "parent" },
      { org_name: "Daughter", relationship_type: "daughter" },
      { org_name: "Sibling", relationship_type: "sister" },
      { org_name: "Z Parent", relationship_type: "parent" },
    ]);
    expect(
      await relationships.findByOrganisationName("Missing' OR 1=1 --"),
    ).to.deep.equal([]);
  });

  it("preserves 100-result pages, including the last and empty pages", async () => {
    const children = Array.from({ length: 205 }, (_, index) => ({
      id: index + 2,
      name: `Child ${String(index).padStart(3, "0")}`,
    }));
    await database<OrganisationRecord>("organisations").insert([
      { id: 1, name: "Parent" },
      ...children,
    ]);
    await database<RelationshipRecord>("relationships").insert(
      children.map(({ id }) => ({ child_id: id, parent_id: 1 })),
    );
    const expected: OrganisationRelationship[] = children.map(({ name }) => ({
      org_name: name,
      relationship_type: "daughter",
    }));
    expect(await relationships.findByOrganisationName("Parent")).to.deep.equal(
      expected.slice(0, 100),
    );
    for (const page of [1, 2, 3, 4]) {
      expect(
        await relationships.findByOrganisationName("Parent", page),
      ).to.deep.equal(expected.slice((page - 1) * 100, page * 100));
    }
  });
});
