import { SchemaBuilder } from 'knex';
import {
  ProposalState,
  proposalTableName,
  ReceiptSupport,
  receiptTableName,
} from '@models/Governance/Entity';

export default (schema: SchemaBuilder) => {
  return schema
    .createTable(proposalTableName, (table) => {
      table.string('network', 64).notNullable();
      table.string('contract', 512).notNullable();
      table.integer('id').notNullable();
      table.string('proposer', 512).notNullable();
      table.integer('eta').notNullable();
      table.jsonb('calldata').notNullable();
      table.integer('startBlock').notNullable();
      table.integer('endBlock').notNullable();
      table.string('forVotes').notNullable();
      table.string('againstVotes').notNullable();
      table.string('abstainVotes').notNullable();
      table.boolean('canceled').notNullable();
      table.boolean('executed').notNullable();
      table
        .enum(
          'state',
          [
            ProposalState.Pending,
            ProposalState.Active,
            ProposalState.Canceled,
            ProposalState.Defeated,
            ProposalState.Succeeded,
            ProposalState.Queued,
            ProposalState.Expired,
            ProposalState.Executed,
          ],
          {
            useNative: true,
            enumName: `${proposalTableName}_state_enum`,
          },
        )
        .notNullable()
        .index();
      table.text('description').notNullable().defaultTo('');
      table.dateTime('createdAt').notNullable();
      table.primary(['network', 'contract', 'id'], `${proposalTableName}_pkey`);
    })
    .createTable(receiptTableName, (table) => {
      table.string('network', 64).notNullable();
      table.string('contract', 512).notNullable();
      table.integer('proposal').notNullable();
      table.string('address', 512).notNullable();
      table.boolean('hasVoted').notNullable();
      table
        .enum('support', [ReceiptSupport.Against, ReceiptSupport.For, ReceiptSupport.Abstain], {
          useNative: true,
          enumName: `${receiptTableName}_support_enum`,
        })
        .notNullable()
        .index();
      table.string('votes', 64).notNullable();
      table.text('reason').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['network', 'contract', 'proposal', 'address'], `${receiptTableName}_pkey`);
    });
};
