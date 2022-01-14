import { SchemaBuilder } from 'knex';
import { protocolTableName, contractTableName } from '@models/Protocol/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(contractTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('protocol', 36).notNullable();
    table.string('blockchain', 64).notNullable();
    table.string('network', 64).notNullable();
    table.string('address', 512).notNullable();
    table.string('name', 512).notNullable();
    table.text('description').notNullable();
    table.string('link', 512).nullable();
    table.boolean('hidden').notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${contractTableName}_pkey`);
    table.index(['blockchain', 'network', 'address']);
    table
      .foreign('protocol')
      .references(`${protocolTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
