import dayjs from 'dayjs';
import container from '@container';
import { metricWalletTaskTableName } from '@models/Metric/Entity';
import {
  contractTableName,
  contractBlockchainTableName,
  walletContractLinkTableName,
} from '@models/Protocol/Entity';
import { Process, TaskStatus } from '@models/Queue/Entity';
import {
  walletBlockchainTableName,
  WalletBlockchainType,
  walletTableName,
} from '@models/Wallet/Entity';

async function createAdapterMetricsCollector(
  links: Array<{ contract: string; wallet: string; task: string }>,
) {
  const queue = container.model.queueService();
  const metricService = container.model.metricService();

  const tasks = await container.model
    .queueTable()
    .whereIn(
      'id',
      links.map(({ task }) => task),
    )
    .then((rows) => new Map(rows.map((task) => [task.id, task])));

  return links.reduce<Promise<string[]>>(async (prev, link) => {
    const res = await prev;

    let task;
    if (link.task) {
      task = tasks.get(link.task);
      if (task) {
        if ([TaskStatus.Pending, TaskStatus.Process].includes(task.status)) {
          return res;
        }
        await queue.resetAndRestart(task);
        return [...res, task.id];
      }
    }
    task = await queue.push(
      'metricsWalletCurrent',
      {
        contract: link.contract,
        wallet: link.wallet,
      },
      { topic: 'metricCurrent' },
    );

    await metricService.setWalletTask(link.contract, link.wallet, task.id);

    return [...res, task.id];
  }, Promise.resolve([]));
}

async function createDebankMetricsCollector(walletsId: Array<{ id: string }>) {
  return walletsId.reduce<Promise<string[]>>(async (prev, { id }) => {
    const res = await prev;

    const task = await container.model
      .queueService()
      .push('metricsWalletBalancesDeBankFiller', { id });
    return [...res, task.id];
  }, Promise.resolve([]));
}

export default async (process: Process) => {
  const queue = container.model.queueService();
  const metricService = container.model.metricService();
  const ids = await container.model.userTable().column('id').orderBy('id');

  const lag = 86400 / ids.length;
  await ids.reduce<Promise<dayjs.Dayjs>>(async (prev, { id: userId }) => {
    const startAt = await prev;

    const [adapterTasksId, debankTasksId] = await Promise.all([
      // Adapter collector
      container.model
        .walletContractLinkTable()
        .columns([
          `${walletContractLinkTableName}.contract`,
          `${walletContractLinkTableName}.wallet`,
          `${metricWalletTaskTableName}.task`,
        ])
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
        .innerJoin(
          walletTableName,
          `${walletTableName}.id`,
          `${walletContractLinkTableName}.wallet`,
        )
        .innerJoin(
          walletBlockchainTableName,
          `${walletTableName}.id`,
          `${walletBlockchainTableName}.id`,
        )
        .leftJoin(metricWalletTaskTableName, function () {
          this.on(`${metricWalletTaskTableName}.contract`, '=', `${contractTableName}.id`);
          this.on(`${metricWalletTaskTableName}.wallet`, '=', `${walletTableName}.id`);
        })
        .where(`${walletTableName}.user`, userId)
        .whereNull(`${walletTableName}.deletedAt`)
        .where(`${contractTableName}.deprecated`, false)
        .whereIn(
          `${walletBlockchainTableName}.network`,
          Object.values(container.blockchain.ethereum.networks)
            .filter(({ hasProvider }) => hasProvider)
            .map(({ id }) => id),
        )
        .then(createAdapterMetricsCollector),
      // Debank collector
      container.model
        .walletTable()
        .column(`${walletTableName}.id`)
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where(`${walletTableName}.user`, userId)
        .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
        .whereNull(`${walletTableName}.deletedAt`)
        .where(`${walletBlockchainTableName}.blockchain`, 'ethereum')
        .whereIn(
          `${walletBlockchainTableName}.network`,
          Object.values(container.blockchain.ethereum.networks)
            .filter(({ testnet }) => !testnet)
            .map(({ id }) => id),
        )
        .then(createDebankMetricsCollector),
    ]);

    const tasks = [...adapterTasksId, ...debankTasksId];
    if (tasks.length === 0) return startAt;
    const collector = await metricService.createUserCollector(userId, [
      ...adapterTasksId,
      ...debankTasksId,
    ]);

    await queue.push(
      'eventsMetricUserCollected',
      { id: collector.id },
      { startAt: dayjs().add(10, 'minutes').toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
