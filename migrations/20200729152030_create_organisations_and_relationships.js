
exports.up = function(knex) {
  return knex.schema.createTable('organisations', function (table) {
    table.increments('id');
    table.string('name');
    table.unique('name');
  }).createTable('relationships', function (table) {
    table.increments('id');
    table.enu('type', ['parent', 'sister', 'daughter'])
    table.integer('source_id').unsigned().notNullable();
    table.foreign('source_id').references('id').inTable('organisations')
    table.integer('target_id').unsigned().notNullable();
    table.foreign('target_id').references('id').inTable('organisations')
  });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('organisations')
    .dropTable('relationships')
};
