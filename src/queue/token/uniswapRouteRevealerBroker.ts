import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const uniswapRoutableTokens = await container.model
    .tokenTable()
    .whereIn(
      'network',
      container.model
        .tokenAliasTable()
        .distinct(`${tokenTableName}.network`)
        .where('liquidity', TokenAliasLiquidity.Stable)
        .andWhere(`${tokenTableName}.blockchain`, 'ethereum')
        .innerJoin(tokenTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`),
    )
    .andWhere('priceFeedNeeded', true)
    .andWhere('blockchain', 'ethereum');

  const lag = 86400 / uniswapRoutableTokens.length;
  await uniswapRoutableTokens.reduce<Promise<dayjs.Dayjs>>(async (prev, token) => {
    const startAt = await prev;

    await container.model.queueService().push(
      'tokenResolveUniswapRoute',
      {
        id: token.id,
      },
      { startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
