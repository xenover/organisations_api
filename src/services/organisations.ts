import knex from "../database/db.js";
import { OrganisationRepository } from "../repositories/organisations.js";
import { RelationshipRepository } from "../repositories/relationships.js";
import type {
  OrganisationInput,
  OrganisationRelationship,
} from "../types/organisations.js";

async function insert(item: OrganisationInput): Promise<number> {
  return knex.transaction(async (transaction) => {
    const organisations = new OrganisationRepository(transaction);
    const relationships = new RelationshipRepository(transaction);
    return insertTree(item, organisations, relationships);
  });
}

async function insertTree(
  item: OrganisationInput,
  organisations: OrganisationRepository,
  relationships: RelationshipRepository,
): Promise<number> {
  const parentId = await organisations.findOrCreate(item.org_name);

  // Every recursive write uses the same transaction-scoped repositories.
  for (const daughter of item.daughters ?? []) {
    const daughterId = await insertTree(daughter, organisations, relationships);
    await relationships.createIfMissing(daughterId, parentId);
  }

  return parentId;
}

async function get(
  orgName: string | undefined,
  page = 1,
): Promise<OrganisationRelationship[]> {
  if (orgName === undefined) {
    throw new Error("Organisation name is required");
  }

  return new RelationshipRepository(knex).findByOrganisationName(orgName, page);
}

export { get, insert };
