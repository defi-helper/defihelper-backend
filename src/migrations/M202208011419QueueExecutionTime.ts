import { SchemaBuilder } from 'knex';
import { tableName as queueTableName } from '@models/Queue/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(queueTableName, (table) => {
    table.dropColumn('collisionSign');
    table.integer('executionTime').nullable();
  });
};
