import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  contractId: string;
  walletId: string;
}

export default async (process: Process) => {
  const { contractId, walletId } = process.task.params as Params;
  const contract = await container.model.contractTable().where('id', contractId).first();

  if (!contract) {
    throw new Error('Parent contract not found');
  }

  const contractBlockchain = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contractId)
    .first();

  if (!contractBlockchain) {
    return process.done().info('Not blockchain contract');
  }

  const walletBlockchain = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, walletId)
    .first();

  if (!walletBlockchain) {
    throw new Error('Wallet not found');
  }

  if (
    contractBlockchain.blockchain !== 'ethereum' ||
    !container.blockchain.ethereum.isNetwork(walletBlockchain.network) ||
    contractBlockchain.deployBlockNumber === null ||
    contractBlockchain.deployBlockNumber === '0'
  ) {
    return process.done();
  }
  const { hasProvider, hasProviderHistorical } = container.blockchain.ethereum.byNetwork(
    walletBlockchain.network,
  );
  if (hasProvider) {
    container.model
      .queueService()
      .push('metricsWalletCurrent', { contract: contract.id, wallet: walletBlockchain.id });
  }
  if (hasProviderHistorical) {
    container.model
      .queueService()
      .push('metricsWalletHistory', { contract: contract.id, wallet: walletBlockchain.id });
  }
  return process.done();
};
