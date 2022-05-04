import { SchemaBuilder } from 'knex';
import { referrerCodeTableName } from '@models/ReferrerCode/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(userTableName, (table) => {
    table.string('referrer', 36).nullable();
    table.foreign('referrer').references(`${referrerCodeTableName}.id`);
  });
};
