// two tables: organisations and relationships
// one to hold organisation specific data (name - unique()
// another to hold relationships data
// (child_id -> parent_id - both referenceing organisations table)

exports.up = function(knex) {
  return knex.schema.createTable('organisations', function(table) {
    table.increments('id');
    table.string('name');
    table.unique('name');
  }).createTable('relationships', function(table) {
    table.increments('id');
    table.integer('child_id').unsigned().notNullable();
    table.foreign('child_id').references('id').inTable('organisations');
    table.integer('parent_id').unsigned().notNullable();
    table.foreign('parent_id').references('id').inTable('organisations');
  });
};

exports.down = function(knex) {
  return knex.schema
      .dropTable('organisations')
      .dropTable('relationships');
};
