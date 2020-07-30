const knex = require('../database/db.js');

handleRelationships = async function(parentId, daughters) {
  if (daughters != undefined && daughters.length > 0) {
    for (const item of daughters) {
      let daughterId = await handleInsert(item);
      console.log(`Handling daughter ${daughterId} of ${parentId}`);
      // add relationship
      knex.insert({type: 'parent', source_id: daughterId, target_id: parentId})
        .into('relationships')
        .then(() => {
          // do nothing, just execute
        });
    };
  };
}

handleInsert = function(item) {
  let parentOrgName = item.org_name;
  let daughters = item.daughters;
  // check for existing records
  return new Promise((resolve,reject) => {
    knex.from('organisations')
      .select('id')
      .where('name', '=', parentOrgName)
      .then((rows) => {
        if (rows.length > 0) {
          // exists, don't insert
          console.log(`Organisation ${parentOrgName} exists, updating relationships`);
          let parentId = rows[0].id;
          handleRelationships(parentId, daughters);
          resolve(parentId);
        } else {
          // insert new record
          console.log(`Inserting new organisation ${parentOrgName}`)
          knex.insert({name: parentOrgName})
            .into('organisations')
            .then((id) => {
              // fetch the ID
              knex.from('organisations')
                .select('id')
                .where('name', '=', parentOrgName)
                .then((rows) => {
                    let parentId = rows[0].id;
                    handleRelationships(parentId, daughters);
                    resolve(parentId);
                });
          });
        };
      });
  });
};

exports.get = function(orgName, page = 1) {
  return knex.raw(
    `SELECT * FROM
(SELECT parent.name as org_name, "parent" as relationship_type FROM organisations parent
JOIN relationships ON parent.id = target_id
JOIN organisations child ON child.id  = source_id
WHERE child.name = ?
UNION
SELECT DISTINCT(sister.name) as org_name, "sister" as relationship_type FROM organisations parent
JOIN relationships r1 ON parent.id = r1.target_id
JOIN organisations child ON child.id  = r1.source_id
JOIN relationships r2 ON r1.target_id = r2.target_id AND r2. source_id != child.id
JOIN organisations sister ON sister.id = r2.source_id
WHERE child.name = ?
UNION
SELECT parent.name as org_name, "daughter" as relationship_type FROM organisations parent
JOIN relationships ON parent.id = source_id
JOIN organisations child ON child.id  = target_id
WHERE child.name = ?)
LIMIT 100
OFFSET ?;`, [orgName, orgName, orgName, page*100-100]
  )
};

exports.insert = function(body) {
  return handleInsert(body)
};
