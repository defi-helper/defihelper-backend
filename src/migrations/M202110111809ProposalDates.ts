import { proposalTableName } from '@models/Proposal/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(proposalTableName, (table) => {
    table.dateTime('plannedAt').nullable();
    table.dateTime('releasedAt').nullable();
  });
};
