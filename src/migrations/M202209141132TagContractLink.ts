import { SchemaBuilder } from 'knex';
import { contractTableName, tagContractLinkTableName } from '@models/Protocol/Entity';
import { tagTableName } from '@models/Tag/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(tagContractLinkTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('tag', 36).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${tagContractLinkTableName}_pkey`);
    table.unique(['contract', 'tag']);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('tag').references(`${tagTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
