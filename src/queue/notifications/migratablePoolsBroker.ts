import { Process } from '@models/Queue/Entity';
import container from '@container';
import { metricWalletRegistryTableName, QueryModify } from '@models/Metric/Entity';
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
} from '@models/Protocol/Entity';
import { contractTableName } from '@models/Automate/Entity';

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
    .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
    .andWhereRaw(`COALESCE(${metricWalletRegistryTableName}.data->>'stakingUSD', '0')::numeric > 0`)
    .andWhere(`${walletTableName}.deletedAt`, null)
    .groupBy(`${metricWalletRegistryTableName}.wallet`)) as any[];

  await candidateWallets.reduce<Promise<ContractMigratableRemindersBulk[]>>(
    async (prev, { wallet }) => {
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
                .where(`${walletTableName}.id`, wallet)
                .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
                .groupBy(`${metricWalletRegistryTableName}.contract`)
                .as('m'),
            )
            .where('m.staked', '>', 0);

          this.whereIn(`${contractTableName}.id`, candidateSelect);
        })) as (Contract & ContractBlockchainType & { wallet: string; staked: string })[];

      return Promise.all(
        contracts.map((contract) => {
          return container.model.contractService().scheduleMigrationReminder(contract, wallet);
        }),
      );
    },
    Promise.resolve([]),
  );
  return process.done();
};
