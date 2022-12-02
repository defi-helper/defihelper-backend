import { Process } from '@models/Queue/Entity';
import container from '@container';
import { metricWalletRegistryTableName, QueryModify, RegistryPeriod } from '@models/Metric/Entity';
import {
  walletTableName,
  walletBlockchainTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';
import {
  Contract,
  ContractBlockchainType,
  contractBlockchainTableName,
  ContractMigratableRemindersBulk,
  contractTableName,
} from '@models/Protocol/Entity';

export default async (process: Process) => {
  const database = container.database();

  const candidateWallets = (await container.model
    .metricWalletRegistryTable()
    .column(`${metricWalletRegistryTableName}.wallet`)
    .modify(QueryModify.sumMetric, [
      'staked',
      `${metricWalletRegistryTableName}.data->>'stakingUSD'`,
    ])
    .innerJoin(walletTableName, `${metricWalletRegistryTableName}.wallet`, `${walletTableName}.id`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Latest)
    .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
    .andWhereRaw(`COALESCE(${metricWalletRegistryTableName}.data->>'stakingUSD', '0')::numeric > 0`)
    .andWhere(`${walletTableName}.deletedAt`, null)
    .groupBy(`${metricWalletRegistryTableName}.wallet`)) as any[];

  await candidateWallets.reduce<Promise<ContractMigratableRemindersBulk[]>>(async (prev, curr) => {
    await prev;

    const contracts = await container.model
      .contractTable()
      .column(`${contractTableName}.*`)
      .column<Array<Contract & ContractBlockchainType & { wallet: string; staked: string }>>(
        `${contractBlockchainTableName}.*`,
      )
      .innerJoin(
        contractBlockchainTableName,
        `${contractBlockchainTableName}.id`,
        `${contractTableName}.id`,
      )
      .where(function () {
        this.where('blockchain', 'ethereum');
        this.where('hidden', false);
        this.where('deprecated', false);
        this.where(database.raw("automate->>'autorestakeAdapter' IS NOT NULL"));
        this.whereIn(
          `${contractTableName}.id`,
          database
            .select('m.contract')
            .from(
              container.model
                .metricWalletRegistryTable()
                .column(`${metricWalletRegistryTableName}.contract`)
                .modify(QueryModify.sumMetric, [
                  'staked',
                  `${metricWalletRegistryTableName}.data->>'stakingUSD'`,
                ])
                .innerJoin(
                  walletTableName,
                  `${metricWalletRegistryTableName}.wallet`,
                  `${walletTableName}.id`,
                )
                .innerJoin(
                  walletBlockchainTableName,
                  `${walletBlockchainTableName}.id`,
                  `${walletTableName}.id`,
                )
                .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Latest)
                .where(`${walletTableName}.id`, curr.wallet)
                .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
                .groupBy(`${metricWalletRegistryTableName}.contract`)
                .as('m'),
            )
            .where('m.staked', '>', 0),
        );
      });

    const wallet = await container.model.walletBlockchainTable().where('id', curr.wallet).first();
    if (!wallet) throw new Error('No wallet found');

    return Promise.all(
      contracts.map((contract) =>
        container.model.contractService().scheduleMigrationReminder(contract, wallet),
      ),
    );
  }, Promise.resolve([]));
  return process.done();
};
