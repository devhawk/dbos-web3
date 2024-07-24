const { Knex } = require("knex");

exports.up = async function(knex) {
  await knex.schema.createTable('transfers', table => {
    table.increments('id').primary();
    table.text('from').notNullable();
    table.text('to').notNullable();
    table.bigint('amount').notNullable();
    table.text('block_hash');
    table.bigint('block_number');
    table.text('transaction_hash');
  });

  return knex.schema.createTable('accounts', table => {
    table.text('address').primary();
    table.bigint('balance').defaultTo(0);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTable('transfers');
  return knex.schema.dropTable('accounts');
};