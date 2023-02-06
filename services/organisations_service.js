const knex = require("../database/db.js");

// handles organisations creation
// can be called recursively to add daughters
async function insert(item) {
	const parentOrgName = item.org_name;
	const daughters = item.daughters;
	// check for existing records
	let rows = await getParent(parentOrgName);
	if (rows.length === 0) {
		// add organisation
		await knex.insert({ name: parentOrgName }).into("organisations").then();
	}
	// get newly created parent org
	rows = await getParent(parentOrgName);
	const parentId = rows[0].id;
	if (daughters && daughters.length > 0) {
		await insertChildren(parentId, daughters);
	}
	// return parentId in case this method was called recursively
	return parentId;
}

// handles relationships creation
// calls handleInsert to add daughter organisations
async function insertChildren(parentId, daughters) {
	for (const item of daughters) {
		// add organisation, get the returned organisation ID for relationship
		const daughterId = await insert(item);
		// check if relationship already exists
		const rows = await getChild(daughterId, parentId);
		if (rows.length === 0) {
			// add relationship
			await insertChild(daughterId, parentId);
		}
	}
}

// unions 3 different queries - parents, sisters and daughters lookups
// orders by name (first column from the subquery)
// does simple pagination using LIMIT and OFFSET based on the page parameter
async function get(orgName = "", page = 1) {
	const limit = 100;
	return knex
		.raw(
			`SELECT * FROM
(SELECT parent.name as org_name, "parent" as relationship_type
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
WHERE child.name = ?)
ORDER BY 1
LIMIT ?
OFFSET ?;`,
			[orgName, orgName, orgName, limit, page * limit - limit]
		)
		.then();
}

async function getParent(parentOrgName) {
	return knex
		.from("organisations")
		.select("id")
		.where({ name: parentOrgName })
		.then();
}

async function getChild(childId, parentId) {
	return knex
		.from("relationships")
		.where({ child_id: childId, parent_id: parentId })
		.then();
}

async function insertChild(childId, parentId) {
	return knex
		.insert({ child_id: childId, parent_id: parentId })
		.into("relationships")
		.then();
}

module.exports = {
	get,
	insert,
};
