import container from '@container';
import { WavesAutomateTransaction } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const automateService = container.model.automateService();

  const transaction = await automateService.transactionTable().where('id', id).first();
  if (!transaction) throw new Error('Transaction not found');

  const contract = await automateService.contractTable().where('id', transaction.contract).first();
  if (!contract) throw new Error('Contract not found');

  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, contract.wallet)
    .first();
  if (!blockchainWallet) throw new Error('Wallet not found');

  const network = container.blockchain.waves.byNetwork(blockchainWallet.network);
  const tx = transaction.data as WavesAutomateTransaction;
  if (!tx.id) throw new Error('Transaction hash not found');

  const {
    statuses: [txStatus],
  } = await network.node.transactions.fetchStatus([tx.id]);
  if (!txStatus) {
    return process.later(dayjs().add(1, 'minutes').toDate());
  }

  const { status } = txStatus;
  if (status === 'in_blockchain') {
    await automateService.updateTransaction({
      ...transaction,
      confirmed: true,
    });
    return process.done();
  }

  return process.later(dayjs().add(1, 'minutes').toDate());
};
