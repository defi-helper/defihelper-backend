import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const tokenAliasList = await container.model
    .tokenAliasTable()
    .column(`${tokenTableName}.address`)
    .column(`${tokenTableName}.network`)
    .column(`${tokenAliasTableName}.id as aliasId`)
    .innerJoin(tokenTableName, `${tokenTableName}.alias`, `${tokenAliasTableName}.id`)
    .where('liquidity', TokenAliasLiquidity.Trash)
    .andWhere('blockchain', 'ethereum')
    .limit(100);

  const lag = 259200 / tokenAliasList.length; // 3 days
  await tokenAliasList.reduce<Promise<dayjs.Dayjs>>(async (prev, params) => {
    const startAt = await prev;

    await container.model
      .queueService()
      .push('resolveTokenAliasLiquidity', params, { startAt: startAt.toDate() });
    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
