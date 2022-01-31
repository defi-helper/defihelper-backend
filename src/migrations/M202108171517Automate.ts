import { SchemaBuilder } from 'knex';
import { walletTableName } from '@models/Wallet/Entity';
import {
  triggerTableName,
  conditionTableName,
  actionTableName,
  contractTableName,
  ContractVerificationStatus,
} from '@models/Automate/Entity';
import { protocolTableName } from '@models/Protocol/Entity';

export default (schema: SchemaBuilder) => {
  return schema
    .createTable(triggerTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('type', 64).notNullable();
      table.string('wallet', 36).notNullable();
      table.string('name', 512).notNullable();
      table.dateTime('lastCallAt').nullable();
      table.boolean('active').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${triggerTableName}_pkey`);
      table
        .foreign('wallet')
        .references(`${walletTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })
    .createTable(conditionTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('trigger', 36).notNullable();
      table.string('type', 64).notNullable();
      table.jsonb('params').notNullable();
      table.integer('priority').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${conditionTableName}_pkey`);
      table
        .foreign('trigger')
        .references(`${triggerTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })
    .createTable(actionTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('trigger', 36).notNullable();
      table.string('type', 64).notNullable();
      table.jsonb('params').notNullable();
      table.integer('priority').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${actionTableName}_pkey`);
      table
        .foreign('trigger')
        .references(`${triggerTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })
    .createTable(contractTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('wallet', 36).notNullable();
      table.string('protocol', 36).notNullable();
      table.string('address', 512).notNullable();
      table.string('adapter', 512).notNullable();
      table
        .enum(
          'verification',
          [
            ContractVerificationStatus.Pending,
            ContractVerificationStatus.Confirmed,
            ContractVerificationStatus.Rejected,
          ],
          {
            useNative: true,
            enumName: `${contractTableName}_verification_enum`,
          },
        )
        .notNullable()
        .index();
      table.string('rejectReason', 512).notNullable().defaultTo('');
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${contractTableName}_pkey`);
      table
        .foreign('protocol')
        .references(`${protocolTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
      table
        .foreign('wallet')
        .references(`${walletTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    });
};
