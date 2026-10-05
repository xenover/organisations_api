import knex from "../database/db.js";
import type {
  OrganisationInput,
  OrganisationRecord,
  OrganisationRelationship,
  RelationshipRecord,
} from "../types/organisations.js";

const LIMIT = 100;

// handles organisations creation
// can be called recursively to add daughters
async function insert(item: OrganisationInput): Promise<number> {
  const { org_name: parentOrgName, daughters } = item;

  // check for existing records
  let rows = await getParent(parentOrgName);

  if (rows.length === 0) {
    // add organisation
    await knex<OrganisationRecord>("organisations").insert({
      name: parentOrgName,
    });
  }

  // get newly created parent org
  rows = await getParent(parentOrgName);

  const parent = rows[0];
  if (!parent) {
    throw new Error(`Organisation not found after insertion: ${parentOrgName}`);
  }
  const parentId = parent.id;

  // insert children if any
  if (daughters && daughters.length > 0) {
    await insertChildren(parentId, daughters);
  }

  // return parentId in case this method was called recursively
  return parentId;
}

// handles relationships creation
// calls handleInsert to add daughter organisations
async function insertChildren(
  parentId: number,
  daughters: OrganisationInput[],
): Promise<void> {
  for (const item of daughters) {
    // add new organisation and its potential daughters
    const daughterId = await insert(item);

    // check if relationship already exists
    const rows = await getChild(daughterId, parentId);

    // not yet, add
    if (rows.length === 0) {
      await insertChild(daughterId, parentId);
    }
  }
}

// unions 3 different queries - parents, sisters and daughters lookups
// orders by name (first column from the subquery)
// does simple pagination using LIMIT and OFFSET based on the page parameter
async function get(
  orgName: string | undefined,
  page = 1,
): Promise<OrganisationRelationship[]> {
  return knex
    .raw<OrganisationRelationship[]>(
      `
SELECT * FROM (
	SELECT parent.name as org_name, "parent" as relationship_type
	FROM organisations parent
	JOIN relationships ON parent.id = parent_id
	JOIN organisations child ON child.id = child_id
	WHERE child.name = ?
	UNION
	SELECT DISTINCT(sister.name) as org_name, "sister" as relationship_type
	FROM organisations parent
	JOIN relationships r1 ON parent.id = r1.parent_id
	JOIN organisations child ON child.id  = r1.child_id
	JOIN relationships r2 ON r1.parent_id = r2.parent_id
		AND r2. child_id != child.id
	JOIN organisations sister ON sister.id = r2.child_id
	WHERE child.name = ?
	UNION
	SELECT parent.name as org_name, "daughter" as relationship_type
	FROM organisations parent
	JOIN relationships ON parent.id = child_id
	JOIN organisations child ON child.id  = parent_id
	WHERE child.name = ?
)
ORDER BY 1
LIMIT ?
OFFSET ?;
`,
      [orgName, orgName, orgName, LIMIT, page * LIMIT - LIMIT],
    )
    .then();
}

async function getParent(
  parentOrgName: string,
): Promise<Pick<OrganisationRecord, "id">[]> {
  return knex
    .from<OrganisationRecord>("organisations")
    .select("id")
    .where({ name: parentOrgName })
    .then();
}

async function getChild(
  childId: number,
  parentId: number,
): Promise<RelationshipRecord[]> {
  return knex
    .from<RelationshipRecord>("relationships")
    .where({ child_id: childId, parent_id: parentId })
    .then();
}

async function insertChild(
  childId: number,
  parentId: number,
): Promise<number[]> {
  return knex<RelationshipRecord>("relationships").insert({
    child_id: childId,
    parent_id: parentId,
  });
}

export { get, insert };
