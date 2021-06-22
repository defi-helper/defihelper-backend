import { SchemaBuilder } from 'knex';
import { tableName, TaskStatus } from '@models/Queue/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(tableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('handler', 512).notNullable().index();
    table.jsonb('params').notNullable();
    table.dateTime('startAt').notNullable();
    table
      .enum(
        'status',
        [
          TaskStatus.Pending,
          TaskStatus.Process,
          TaskStatus.Done,
          TaskStatus.Error,
          TaskStatus.Collision,
        ],
        {
          useNative: true,
          enumName: `${tableName}_status_enum`,
        },
      )
      .notNullable()
      .index();
    table.text('info').notNullable();
    table.text('error').notNullable();
    table.string('collisionSign', 512).nullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${tableName}_pkey`);
  });
};
