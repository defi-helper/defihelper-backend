import { SchemaBuilder } from 'knex';
import { TokenAliasLiquidity, tokenAliasTableName } from '@models/Token/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(tokenAliasTableName, (table) => {
    table.string('liquidity', 64).notNullable().index().defaultTo(TokenAliasLiquidity.Trash);
  });

  await container.model
    .tokenAliasTable()
    .update({
      liquidity: TokenAliasLiquidity.Stable,
    })
    .where('stable', true);
  await container.model
    .tokenAliasTable()
    .update({
      liquidity: TokenAliasLiquidity.Unstable,
    })
    .where('stable', false);
};
