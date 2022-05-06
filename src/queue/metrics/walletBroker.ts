import container from '@container';
import { contractTableName, walletContractLinkTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const links = await container.model
    .walletContractLinkTable()
    .innerJoin(
      contractTableName,
      `${contractTableName}.id`,
      `${walletContractLinkTableName}.contract`,
    )
    .andWhere(`${contractTableName}.deprecated`, false);
  await Promise.all(
    links.map(async (link) => {
      queue.push(
        'metricsWalletCurrent',
        {
          contract: link.contract,
          wallet: link.wallet,
        },
        {
          topic: 'metricCurrent',
        },
      );
    }),
  );

  return process.done();
};
