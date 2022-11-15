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

    const contracts = (await container.model
      .contractTable()
      .innerJoin(
        contractBlockchainTableName,
        `${contractBlockchainTableName}.id`,
        `${contractTableName}.id`,
      )
      .column(`${contractTableName}.*`)
      .column(`${contractBlockchainTableName}.*`)
      .where(function () {
        this.andWhere({
          blockchain: 'ethereum',
          hidden: false,
          deprecated: false,
        });

        this.where(database.raw("automate->>'autorestakeAdapter' IS NOT NULL"));

        const candidateSelect = database
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
          .where('m.staked', '>', 0);

        this.whereIn(`${contractTableName}.id`, candidateSelect);
      })) as (Contract & ContractBlockchainType & { wallet: string; staked: string })[];

    const wallet = await container.model.walletBlockchainTable().where('id', curr.wallet).first();
    if (!wallet) throw new Error('No contract found');

    return Promise.all(
      contracts.map((contract) => {
        return container.model.contractService().scheduleMigrationReminder(contract, wallet);
      }),
    );
  }, Promise.resolve([]));
  return process.done();
};
