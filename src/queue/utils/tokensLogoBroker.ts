import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { tokenAliasTableName, tokenTableName } from '@models/Token/Entity';

export default async (process: Process) => {
  const tokens = await container.model
    .tokenTable()
    .column(`${tokenAliasTableName}.id`)
    .column(`${tokenTableName}.network`)
    .column(`${tokenTableName}.address`)
    .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
    .whereNot(`${tokenAliasTableName}.logoUrl`, null);

  const lag = 600 / tokens.length;
  await tokens.reduce<Promise<dayjs.Dayjs>>(async (prev, token) => {
    const startAt = await prev;

    await container.model.queueService().push(
      'resolveTokenAliasLiquidity',
      {
        aliasId: token.id,
        network: token.network,
        address: token.address,
      },
      { startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
