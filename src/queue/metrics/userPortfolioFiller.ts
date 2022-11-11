import container from '@container';
import { Process, TaskStatus } from '@models/Queue/Entity';
import { metricWalletTaskTableName } from '@models/Metric/Entity';
import {
  contractTableName,
  contractBlockchainTableName,
  walletContractLinkTableName,
} from '@models/Protocol/Entity';
import { tableName as userTableName } from '@models/User/Entity';
import {
  walletBlockchainTableName,
  WalletBlockchainType,
  walletExchangeTableName,
  walletTableName,
} from '@models/Wallet/Entity';
import dayjs from 'dayjs';

async function createAdapterMetricsCollector(
  priority: number,
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
      { topic: 'metricCurrent', priority },
    );

    await metricService.setWalletTask(link.contract, link.wallet, task.id);

    return [...res, task.id];
  }, Promise.resolve([]));
}

function createDebankBalanceMetricsCollector(priority: number, walletsId: Array<{ id: string }>) {
  return walletsId.reduce<Promise<string[]>>(async (prev, { id }) => {
    const res = await prev;

    const task = await container.model
      .queueService()
      .push('metricsWalletBalancesDeBankFiller', { id }, { topic: 'metricCurrent', priority });
    return [...res, task.id];
  }, Promise.resolve([]));
}

function createDebankContractMetricsCollector(priority: number, walletsId: Array<{ id: string }>) {
  return walletsId.reduce<Promise<string[]>>(async (prev, { id }) => {
    const res = await prev;

    const task = await container.model
      .queueService()
      .push(
        'metricsWalletProtocolsBalancesDeBankFiller',
        { id },
        { topic: 'metricCurrent', priority },
      );
    return [...res, task.id];
  }, Promise.resolve([]));
}

function createCentralizedExchangeMetricsCollector(
  priority: number,
  walletsId: Array<{ id: string }>,
) {
  return walletsId.reduce<Promise<string[]>>(async (prev, { id }) => {
    const res = await prev;

    const task = await container.model
      .queueService()
      .push(
        'metricsWalletBalancesCexUniversalFiller',
        { id },
        { topic: 'metricCurrent', priority },
      );
    return [...res, task.id];
  }, Promise.resolve([]));
}

export interface Params {
  userId: string;
  priority: number;
  notify: boolean;
}

export default async (process: Process) => {
  const { userId, priority, notify } = process.task.params as Params;

  const [adapterTasksId, debankBalanceTasksId, debankContractTasksId, centralizedExchangeTasksId] =
    await Promise.all([
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
        .then(createAdapterMetricsCollector.bind(null, priority)),
      // Debank balance collector
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
        .then(createDebankBalanceMetricsCollector.bind(null, priority)),
      // Debank contract collector
      container.model
        .walletTable()
        .distinctOn(`${walletBlockchainTableName}.address`)
        .column(`${walletBlockchainTableName}.id`)
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .innerJoin(userTableName, `${walletTableName}.user`, `${userTableName}.id`)
        .where(`${walletTableName}.user`, userId)
        .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
        .andWhere(`${walletBlockchainTableName}.blockchain`, 'ethereum')
        .whereNull(`${walletTableName}.deletedAt`)
        .then(createDebankContractMetricsCollector.bind(null, priority)),
      // Centralized exchange collector
      container.model
        .walletTable()
        .innerJoin(
          walletExchangeTableName,
          `${walletExchangeTableName}.id`,
          `${walletTableName}.id`,
        )
        .where(`${walletTableName}.suspendReason`, null)
        .whereNull(`${walletTableName}.deletedAt`)
        .then(createCentralizedExchangeMetricsCollector.bind(null, priority)),
    ]);

  const tasks = [
    ...adapterTasksId,
    ...debankBalanceTasksId,
    ...debankContractTasksId,
    ...centralizedExchangeTasksId,
  ];
  if (tasks.length === 0) {
    return process.done();
  }
  if (notify) {
    const collector = await container.model
      .metricService()
      .createUserCollector(userId, [...adapterTasksId, ...debankBalanceTasksId]);
    await container.model
      .queueService()
      .push(
        'eventsMetricUserCollected',
        { id: collector.id },
        { startAt: dayjs().add(10, 'minutes').toDate() },
      );
  }

  return process.done();
};
