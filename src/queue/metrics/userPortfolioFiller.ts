import container from '@container';
import { Process } from '@models/Queue/Entity';
import {
  walletBlockchainTableName,
  walletExchangeTableName,
  walletTableName,
} from '@models/Wallet/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id: user } = process.task.params as Params;

  const [walletsBlockchain, walletsExchange] = await Promise.all([
    container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.user`, user),
    container.model
      .walletTable()
      .innerJoin(walletExchangeTableName, `${walletExchangeTableName}.id`, `${walletTableName}.id`)
      .where(`${walletTableName}.user`, user),
  ]);

  const queue = container.model.queueService();
  walletsBlockchain.forEach(({ id, blockchain, network }) => {
    if (blockchain !== 'ethereum' || container.blockchain.ethereum.byNetwork(network).testnet) {
      return;
    }
    queue.push('metricsWalletBalancesDeBankFiller', { id }, { priority: 9 });
    queue.push('metricsWalletProtocolsBalancesDeBankFiller', { id }, { priority: 9 });
  });
  walletsExchange.forEach(({ id }) =>
    queue.push('metricsWalletBalancesCexUniversalFiller', { id }, { priority: 9 }),
  );

  return process.done();
};
