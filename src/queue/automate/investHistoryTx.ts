import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const invest = await container.model.automateInvestHistoryTable().where('id', id).first();
  if (!invest) {
    throw new Error('Automate contract invest history not found');
  }
  if (invest.confirmed) {
    return process.done();
  }

  const wallet = await container.model.walletBlockchainTable().where('id', invest.wallet).first();
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  if (wallet.blockchain !== 'ethereum') {
    throw new Error('Ethereum blockchain supported only');
  }

  const provider = container.blockchain.ethereum.byNetwork(wallet.network).provider();

  try {
    const receipt = await provider.waitForTransaction(invest.tx, 1, 10000);
    if (receipt.status === 0) {
      return process.done();
    }

    await container.model.automateService().confirmInvestHistory(invest.id);
    container
      .cache()
      .publish(
        'defihelper:channel:onAutomateContractChanged',
        JSON.stringify({ id: invest.contract }),
      );

    return process.done();
  } catch (e) {
    if (process.task.attempt < 10) {
      return process.later(dayjs().add(10, 'seconds').toDate());
    }
    throw e;
  }
};
