const knex = require('../database/db.js');

// handles relationships creation
// calls handleInsert to add daughter organisations
handleRelationships = async function(parentId, daughters) {
  if (daughters != undefined && daughters.length > 0) {
    for (const item of daughters) {
      // add organisation, get the returned organisation ID for relationship
      const daughterId = await handleInsert(item);
      // check if relationship already exists
      knex.from('relationships')
          .where({child_id: daughterId, parent_id: parentId})
          .then((rows) => {
            if (rows.length == 0) {
              // add relationship
              return knex.insert({child_id: daughterId, parent_id: parentId})
                  .into('relationships');
            };
          });
    };
  };
};

// handles organisations creation
// can be called recursively to add daughters
handleInsert = function(item) {
  const parentOrgName = item.org_name;
  const daughters = item.daughters;
  return new Promise((resolve, reject) => {
    // check for existing records
    knex.from('organisations')
        .select('id')
        .where({name: parentOrgName})
        .then((rows) => {
          if (rows.length > 0) {
            // exists - don't insert but add relationships
            const parentId = rows[0].id;
            handleRelationships(parentId, daughters);
            // return parentId in case this method was called recursively
            resolve(parentId);
          } else {
            // add organisation
            knex.insert({name: parentOrgName})
                .into('organisations')
                .then(() => {
                  // fetch the ID since sql lite doesn't support RETURNING(ID)
                  knex.from('organisations')
                      .select('id')
                      .where({name: parentOrgName})
                      .then((rows) => {
                        // add relationships
                        const parentId = rows[0].id;
                        handleRelationships(parentId, daughters);
                        resolve(parentId);
                      });
                });
          };
        });
  });
};

// unions 3 different queries - parents, sisters and daughters lookups
// orders by name (first column from the subquery)
// does simple pagination using LIMIT and OFFSET based on the page parameter
exports.get = function(orgName = '', page = 1) {
  const limit = 100;
  return knex.raw(
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
OFFSET ?;`, [orgName, orgName, orgName, limit, page*limit-limit],
  );
};

exports.insert = function(body) {
  handleInsert(body);
};
