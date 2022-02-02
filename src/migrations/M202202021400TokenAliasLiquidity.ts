import container from '@container';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';

export default async () => {
  await container.model
    .tokenAliasTable()
    .update({ liquidity: TokenAliasLiquidity.Unstable })
    .whereNotNull('logoUrl')
    .andWhere('liquidity', TokenAliasLiquidity.Trash);

  const tokens = await container.model
    .tokenTable()
    .distinctOn(`${tokenTableName}.alias`)
    .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
    .whereIn(`${tokenAliasTableName}.liquidity`, [
      TokenAliasLiquidity.Trash,
      TokenAliasLiquidity.Unknown,
    ]);

  await Promise.all(
    tokens.map((v) =>
      container.model.queueService().push('resolveTokenAliasLiquidity', {
        aliasId: v.alias,
        network: v.network,
        address: v.address,
      }),
    ),
  );
};
