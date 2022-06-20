import container from '@container';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  walletId: string;
}

export default async (process: Process) => {
  const { walletId } = process.task.params as Params;
  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, walletId)
    .first();
  if (!blockchainWallet) throw new Error('Wallet is not found');
  if (blockchainWallet.blockchain !== 'ethereum') {
    return process.done();
  }

  const interactions = await container
    .scanner()
    .getWalletInteractions(blockchainWallet.network, blockchainWallet.address);
  const contractService = container.model.contractService();
  await interactions.reduce(async (prev, { contract: contractAddress }) => {
    await prev;
    const contract = await container.model
      .contractTable()
      .innerJoin(
        contractBlockchainTableName,
        `${contractBlockchainTableName}.id`,
        `${contractTableName}.id`,
      )
      .andWhere('blockchain', blockchainWallet.blockchain)
      .andWhere('network', blockchainWallet.network)
      .andWhere('address', contractAddress.toLowerCase())
      .first();
    if (contract) await contractService.walletLink(contract, blockchainWallet);
    return null;
  }, Promise.resolve(null));

  return process.done();
};
