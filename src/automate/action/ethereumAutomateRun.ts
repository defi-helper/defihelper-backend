import container from '@container';
import {
  contractTableName,
  ContractVerificationStatus,
  EthereumAutomateTransaction,
  transactionTableName,
} from '@models/Automate/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import { EthereumAutomateAdapter } from '@services/Blockchain/Adapter';
import { Wallet } from 'ethers';

interface Params {
  id: string;
}

export default async (params: Params) => {
  const contract = await container.model.automateContractTable().where('id', params.id).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.verification !== ContractVerificationStatus.Confirmed) {
    throw new Error('Contract not verified');
  }

  const wallet = await container.model.walletTable().where('id', contract.wallet).first();
  if (!wallet) throw new Error('Wallet not found');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const { automates } = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  if (!automates || typeof automates !== 'object') throw new Error('Automates adapters not found');
  const adapter = automates[contract.adapter] as EthereumAutomateAdapter;
  if (typeof adapter !== 'function') throw new Error('Automate adapter not found');

  const network = container.blockchain.ethereum.byNetwork(wallet.network);
  const consumers = network.consumers();

  const busyConsumers = await container.model
    .automateTransactionTable()
    .distinct(`${transactionTableName}.consumer`)
    .join(contractTableName, `${transactionTableName}.contract`, '=', `${contractTableName}.id`)
    .join(walletTableName, `${contractTableName}.wallet`, '=', `${walletTableName}.id`)
    .where(function () {
      this.andWhere(`${walletTableName}.blockchain`, wallet.blockchain)
        .andWhere(`${walletTableName}.network`, wallet.network)
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

    const data: EthereumAutomateTransaction = {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      nonce: tx.nonce,
    };
    await container.model.automateService().createTransaction(contract, consumer.address, data);
  } catch (e) {
    await container
      .semafor()
      .unlock(
        `defihelper:automate:consumer:${wallet.blockchain}:${wallet.network}:${consumer.address}`,
      );
    throw e;
  }
};
