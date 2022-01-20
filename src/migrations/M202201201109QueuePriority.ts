import { SchemaBuilder } from 'knex';
import { tableName } from '@models/Queue/Entity';
import { QueueService } from '@models/Queue/Service';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(tableName, (table) => {
    table.integer('priority').notNullable().defaultTo(QueueService.defaultPriority);
    table.string('topic', 64).notNullable().defaultTo(QueueService.defaultTopic);
  });
};
