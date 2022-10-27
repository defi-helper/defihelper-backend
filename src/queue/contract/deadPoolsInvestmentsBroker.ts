import container from '@container';
import * as Automate from '@models/Automate/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import BN from 'bignumber.js';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const queue = container.model.queueService();

  const deadInvestmentsList = await container.model
    .automateContractTable()
    .column(
      container
        .database()
        .raw(
          `COALESCE(${contractBlockchainTableName}.metric->>'aprYear', '0')::float as "currentApy"`,
        ),
    )
    .column(`${contractTableName}.name as "contractName"`)
    .column(`${walletTableName}.user as "userId"`)
    .innerJoin(walletTableName, `${walletTableName}.id`, `${Automate.contractTableName}.wallet`)
    .leftJoin(
      contractTableName,
      `${contractTableName}.id`,
      `${Automate.contractTableName}.contract`,
    )
    .leftJoin(
      contractBlockchainTableName,
      `${contractTableName}.id`,
      `${contractBlockchainTableName}.id`,
    )
    .whereNull(`${Automate.contractTableName}.archivedAt`)
    .andWhereRaw(
      `COALESCE("${contractBlockchainTableName}".metric->>'aprYear', '0')::float < 0.01`,
    );

  const contacts = await container.model.userContactTable().whereIn(
    'user',
    deadInvestmentsList.map((v) => v.userId),
  );

  const lag = 10800 / deadInvestmentsList.length; // 3hrs
  await deadInvestmentsList.reduce<Promise<dayjs.Dayjs>>(async (prev, investment) => {
    const startAt = await prev;

    await Promise.all(
      contacts
        .filter((contact) => contact.user === investment.userId)
        .map((contact) =>
          queue.push('sendTelegramByContact', {
            contactId: contact.id,
            template: 'deadInvestmentWarning',
            params: {
              contractName: investment.contractName,
              apy: new BN(investment.currentApy).multipliedBy(100).toFixed(2),
            },
          }),
        ),
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
