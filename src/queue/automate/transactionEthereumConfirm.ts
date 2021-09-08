import container from '@container';
import { EthereumAutomateTransaction } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

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

  const network = container.blockchain.ethereum.byNetwork(contract.network);
  const provider = network.provider();
  const { hash } = transaction.data as EthereumAutomateTransaction;
  if (!hash) throw new Error('Transaction hash not found');

  const receipt = await provider.getTransactionReceipt(hash);
  if (receipt === null) {
    return process.later(dayjs().add(1, 'minutes').toDate());
  }

  await Promise.all([
    container
      .semafor()
      .unlock(
        `defihelper:automate:consumer:${contract.blockchain}:${contract.network}:${transaction.consumer}`,
      ),
    automateService.updateTransaction({
      ...transaction,
      confirmed: true,
      data: {
        ...transaction.data,
        receipt: {
          contractAddress: receipt.contractAddress,
          gasUsed: receipt.gasUsed.toString(),
          blockHash: receipt.blockHash,
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations,
          status: receipt.status !== 0,
        },
      },
    }),
  ]);

  return process.done();
};
