import container from '@container';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import BN from 'bignumber.js';
import dayjs from 'dayjs';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const automate = await container.model.automateContractTable().where('id', id).first();
  if (!automate) {
    throw new Error('Automate not found');
  }
  if (automate.archivedAt !== null) {
    return process.done();
  }

  const contract = await container.model.contractTable().where('id', automate.contract).first();
  if (!contract) throw new Error('Contract not found');

  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, automate.contractWallet)
    .first();
  if (!blockchainWallet) throw new Error('Wallet not found');

  const db = container.database();
  const [investUSD, deltaEarnedUSD] = await Promise.all([
    container.model
      .automateInvestHistoryTable()
      .sum('amountUSD')
      .where('contract', automate.id)
      .first()
      .then((row) => new BN(row?.sum ?? 0)),
    container.model
      .metricWalletTable()
      .column<{ sum: number | null }>(
        db.raw(`SUM((COALESCE(data->>'deltaEarnedUSD', '0'))::double precision) AS sum`),
      )
      .where('contract', automate.contract)
      .where('wallet', automate.contractWallet)
      .where('date', '>=', dayjs().add(-1, 'day').startOf('day').toDate())
      .where('date', '<', dayjs().startOf('day').toDate())
      .first()
      .then((row) => new BN(row?.sum ?? 0)),
  ]);

  await container.model.metricService().createWallet(
    contract,
    blockchainWallet,
    {
      aprFeeDay: investUSD.gt(0) ? new BN(deltaEarnedUSD).div(investUSD).toString(10) : '0',
    },
    new Date(),
  );

  return process.done();
};
