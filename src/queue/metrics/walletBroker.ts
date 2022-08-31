import container from '@container';
import { metricWalletTaskTableName } from '@models/Metric/Entity';
import {
  contractTableName,
  contractBlockchainTableName,
  walletContractLinkTableName,
  WalletContractLink,
} from '@models/Protocol/Entity';
import { Process, TaskStatus } from '@models/Queue/Entity';
import { walletTableName } from '@models/Wallet/Entity';

export default async (process: Process) => {
  const metricService = container.model.metricService();
  const queue = container.model.queueService();

  const links: Array<WalletContractLink & { task: string }> = await container.model
    .walletContractLinkTable()
    .columns([`${walletContractLinkTableName}.*`, `${metricWalletTaskTableName}.task`])
    .innerJoin(
      contractTableName,
      `${contractTableName}.id`,
      `${walletContractLinkTableName}.contract`,
    )
    .innerJoin(
      contractBlockchainTableName,
      `${contractTableName}.id`,
      `${contractBlockchainTableName}.id`,
    )
    .innerJoin(walletTableName, `${walletTableName}.id`, `${walletContractLinkTableName}.wallet`)
    .leftJoin(metricWalletTaskTableName, function () {
      this.on(`${metricWalletTaskTableName}.contract`, '=', `${contractTableName}.id`);
      this.on(`${metricWalletTaskTableName}.wallet`, '=', `${walletTableName}.id`);
    })
    .whereNull(`${walletTableName}.deletedAt`)
    .andWhere(`${contractTableName}.deprecated`, false);

  await Promise.all(
    links.map(async (link) => {
      const [wallet, contract] = await Promise.all([
        container.model.walletTable().where('id', link.wallet).first(),
        container.model
          .contractTable()
          .innerJoin(
            contractBlockchainTableName,
            `${contractTableName}.id`,
            `${contractBlockchainTableName}.id`,
          )
          .where(`${contractTableName}.id`, link.contract)
          .first(),
      ]);
      if (!wallet || !contract) return null;

      const network = container.blockchain[contract.blockchain].byNetwork(contract.network);
      if (!network.hasProvider) return null;

      let task;
      if (link.task) {
        task = await queue.queueTable().where('id', link.task).first();
        if (task) {
          if ([TaskStatus.Pending, TaskStatus.Process].includes(task.status)) return null;
          return queue.resetAndRestart(task);
        }
      }
      task = await queue.push(
        'metricsWalletCurrent',
        {
          contract: contract.id,
          wallet: wallet.id,
        },
        { topic: 'metricCurrent' },
      );
      return metricService.setWalletTask(contract, wallet, task);
    }),
  );

  return process.done();
};
