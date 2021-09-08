import container from '@container';
import {
  contractTableName,
  ContractVerificationStatus,
  EthereumAutomateTransaction,
  transactionTableName,
} from '@models/Automate/Entity';
import { EthereumAutomateAdapter } from '@services/Blockchain/Adapter';

interface Params {
  id: string;
}

export default async (params: Params) => {
  const contract = await container.model.automateContractTable().where('id', params.id).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.verification !== ContractVerificationStatus.Confirmed) {
    throw new Error('Contract not verified');
  }

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const { automates } = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  if (!automates || typeof automates !== 'object') throw new Error('Automates adapters not found');
  const adapter = automates[contract.adapter] as EthereumAutomateAdapter;
  if (typeof adapter !== 'function') throw new Error('Automate adapter not found');

  const network = container.blockchain.ethereum.byNetwork(contract.network);
  const consumers = network.consumers();
  const busyConsumersRows = await container.model
    .automateTransactionTable()
    .distinct(`${transactionTableName}.address`)
    .join(contractTableName, `${transactionTableName}.contract`, '=', `${contractTableName}.id`)
    .where(function () {
      this.andWhere(`${contractTableName}.blockchain`, contract.blockchain)
        .andWhere(`${contractTableName}.network`, contract.network)
        .andWhere(`${transactionTableName}.confirmed`, false)
        .whereIn(
          `${transactionTableName}.consumer`,
          consumers.map(({ address }) => address),
        );
    });
  const busyConsumers = busyConsumersRows.map(({ address }) => address);
  const freeConsumers = consumers.filter(({ address }) => !busyConsumers.includes(address));
  if (freeConsumers.length === 0) throw new Error('Not free consumer');
  const [consumer] = freeConsumers;
  await container
    .semafor()
    .lock(
      `defihelper:automate:consumer:${contract.blockchain}:${contract.network}:${consumer.address}`,
    );

  const { run } = await adapter(consumer, contract.address);
  const tx = await run();
  if (tx instanceof Error) throw tx;

  const data: EthereumAutomateTransaction = {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    nonce: tx.nonce,
  };
  await container.model.automateService().createTransaction(contract, consumer.address, data);
};
