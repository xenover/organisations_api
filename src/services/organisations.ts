import type { Knex } from "knex";
import knex from "../database/db.js";
import { ConflictError, NotFoundError } from "../errors/index.js";
import { ERROR_DEFINITIONS } from "../errors/definitions.js";
import type {
  Organisation,
  OrganisationInput,
  OrganisationRecord,
  OrganisationRelationship,
  PaginatedResponse,
  PaginationQuery,
  RelationshipRecord,
} from "../types/organisations.js";

async function insert(item: OrganisationInput, db: Knex): Promise<number> {
  let parent = await db<OrganisationRecord>("organisations")
    .where({ name: item.org_name })
    .first();
  if (!parent) {
    const [id] = await db<OrganisationRecord>("organisations").insert({
      name: item.org_name,
    });
    if (id === undefined) throw new Error("Organisation insert returned no ID");
    parent = { id, name: item.org_name };
  }
  for (const daughter of item.daughters ?? []) {
    const childId = await insert(daughter, db);
    const relationship = await db<RelationshipRecord>("relationships")
      .where({ child_id: childId, parent_id: parent.id })
      .first();
    if (!relationship) {
      await db<RelationshipRecord>("relationships").insert({
        child_id: childId,
        parent_id: parent.id,
      });
    }
  }
  return parent.id;
}

// Creating or extending a tree is atomic, including all recursive daughters.
export async function create(item: OrganisationInput) {
  return knex.transaction(async (db) => {
    const existing = await db<OrganisationRecord>("organisations")
      .where({ name: item.org_name })
      .first();
    const id = await insert(item, db);
    return {
      organisation: { id, org_name: item.org_name },
      created: existing === undefined,
    };
  });
}

async function findById(id: number, db: Knex): Promise<Organisation> {
  const row = await db<OrganisationRecord>("organisations")
    .where({ id })
    .first();
  if (!row)
    throw new NotFoundError(ERROR_DEFINITIONS.ORGANISATION_NOT_FOUND.message);
  return { id: row.id, org_name: row.name };
}

export function getById(id: number): Promise<Organisation> {
  return findById(id, knex);
}

export async function update(id: number, name: string): Promise<Organisation> {
  try {
    return await knex.transaction(async (db) => {
      await findById(id, db);
      const duplicate = await db<OrganisationRecord>("organisations")
        .where({ name })
        .whereNot({ id })
        .first();
      if (duplicate) throw new ConflictError();
      await db<OrganisationRecord>("organisations")
        .where({ id })
        .update({ name });
      return { id, org_name: name };
    });
  } catch (error) {
    // The unique constraint also protects against a conflicting concurrent rename.
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "SQLITE_CONSTRAINT" &&
      error.message.includes("UNIQUE constraint failed: organisations.name")
    ) {
      throw new ConflictError();
    }
    throw error;
  }
}

export async function remove(id: number): Promise<Organisation> {
  return knex.transaction(async (db) => {
    const organisation = await findById(id, db);
    await db<RelationshipRecord>("relationships")
      .where({ child_id: id })
      .orWhere({ parent_id: id })
      .del();
    await db<OrganisationRecord>("organisations").where({ id }).del();
    return organisation;
  });
}

// Keep the existing parent/sister/daughter lookup semantics and UNION deduplication.
const relationshipsSql = `
  SELECT parent.name AS org_name, 'parent' AS relationship_type
  FROM organisations parent
  JOIN relationships ON parent.id = parent_id
  JOIN organisations child ON child.id = child_id
  WHERE child.name = ?
  UNION
  SELECT DISTINCT(sister.name) AS org_name, 'sister' AS relationship_type
  FROM organisations parent
  JOIN relationships r1 ON parent.id = r1.parent_id
  JOIN organisations child ON child.id = r1.child_id
  JOIN relationships r2 ON r1.parent_id = r2.parent_id AND r2.child_id != child.id
  JOIN organisations sister ON sister.id = r2.child_id
  WHERE child.name = ?
  UNION
  SELECT parent.name AS org_name, 'daughter' AS relationship_type
  FROM organisations parent
  JOIN relationships ON parent.id = child_id
  JOIN organisations child ON child.id = parent_id
  WHERE child.name = ?
`;

async function readRelationships(
  db: Knex,
  name: string,
  pagination: PaginationQuery,
): Promise<PaginatedResponse<OrganisationRelationship>> {
  const bindings = [name, name, name];
  const data = await db.raw<OrganisationRelationship[]>(
    `SELECT * FROM (${relationshipsSql}) ORDER BY org_name, relationship_type LIMIT ? OFFSET ?`,
    [...bindings, pagination.limit, pagination.offset],
  );
  const [count] = await db.raw<{ total_count: number }[]>(
    `SELECT COUNT(*) AS total_count FROM (${relationshipsSql})`,
    bindings,
  );
  if (!count) throw new Error("Relationship count returned no row");
  return {
    data,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      total_count: count.total_count,
    },
  };
}

export function get(name: string, pagination: PaginationQuery) {
  return knex.transaction((db) => readRelationships(db, name, pagination));
}

export async function getRelationships(
  id: number,
  pagination: PaginationQuery,
) {
  return knex.transaction(async (db) => {
    const organisation = await findById(id, db);
    return readRelationships(db, organisation.org_name, pagination);
  });
}
