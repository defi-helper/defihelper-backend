import container from '@container';
import {
  contractTableName,
  ContractVerificationStatus,
  EthereumAutomateTransaction,
  transactionTableName,
} from '@models/Automate/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { EthereumProtocolAdapter } from '@services/Blockchain/Adapter';
import { Wallet } from 'ethers';
import * as uuid from 'uuid';

export interface Params {
  id: string;
}

export function paramsVerify(params: any): params is Params {
  const { id } = params;
  if (typeof id !== 'string' || !uuid.validate(id)) {
    throw new Error('Invalid automate contract identifier');
  }

  return true;
}

export default async (params: Params) => {
  const contract = await container.model.automateContractTable().where('id', params.id).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.verification !== ContractVerificationStatus.Confirmed) {
    throw new Error('Contract not verified');
  }
  if (contract.archivedAt !== null) {
    throw new Error('Contract on archive');
  }

  const wallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, contract.wallet)
    .first();
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.blockchain !== 'ethereum') throw new Error('Invalid blockchain');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const { automates } = await container.blockchainAdapter.loadAdapter<EthereumProtocolAdapter>(
    protocol.adapter,
  );
  if (!automates) throw new Error('Automates adapters not found');
  const adapter = automates[contract.adapter];
  if (adapter === undefined) throw new Error('Automate adapter not found');

  const network = container.blockchain.ethereum.byNetwork(wallet.network);
  const consumers = network.consumers();

  const busyConsumers = await container.model
    .automateTransactionTable()
    .distinct(`${transactionTableName}.consumer`)
    .innerJoin(contractTableName, `${transactionTableName}.contract`, `${contractTableName}.id`)
    .innerJoin(walletTableName, `${contractTableName}.wallet`, `${walletTableName}.id`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(function () {
      this.andWhere(`${walletBlockchainTableName}.blockchain`, wallet.blockchain)
        .andWhere(`${walletBlockchainTableName}.network`, wallet.network)
        .andWhere(`${transactionTableName}.confirmed`, false)
        .whereIn(
          `${transactionTableName}.consumer`,
          consumers.map(({ address }) => address),
        );
    })
    .then((rows) => rows.map(({ consumer }) => consumer));
  const freeConsumers = consumers.filter(({ address }) => !busyConsumers.includes(address));
  if (freeConsumers.length === 0) throw new Error('Not free consumer');

  const consumer = await freeConsumers.reduce<Promise<Wallet | null>>(async (prev, current) => {
    const result = await prev;
    if (result !== null) return result;

    return container
      .semafor()
      .lock(
        `defihelper:automate:consumer:${wallet.blockchain}:${wallet.network}:${current.address}`,
      )
      .then(() => current)
      .catch(() => null);
  }, Promise.resolve(null));
  if (consumer === null) throw new Error('Not free consumer');

  const { run } = await adapter(consumer, contract.address);
  try {
    const tx = await run();
    if (tx instanceof Error) throw tx;

    await container.model
      .automateService()
      .createTransaction<EthereumAutomateTransaction>(contract, consumer.address, {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        nonce: tx.nonce,
      });
  } catch (e) {
    await container
      .semafor()
      .unlock(
        `defihelper:automate:consumer:${wallet.blockchain}:${wallet.network}:${consumer.address}`,
      );
    throw e;
  }
};
