import container from '@container';
import { ContractVerificationStatus } from '@models/Automate/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { WavesProtocolAdapter } from '@services/Blockchain/Adapter';
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
  if (wallet.blockchain !== 'waves') throw new Error('Invalid blockchain');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const { automates } = await container.blockchainAdapter.loadAdapter<WavesProtocolAdapter>(
    protocol.adapter,
  );
  if (!automates) throw new Error('Automates adapters not found');
  const adapter = automates[contract.adapter];
  if (adapter === undefined) throw new Error('Automate adapter not found');

  const network = container.blockchain.waves.byNetwork(wallet.network);
  const consumers = network.consumers();
  const consumer = consumers[Math.floor(Math.random() * consumers.length)];
  if (consumer === undefined) throw new Error('Not free consumer');

  /*
  const { run } = await adapter(consumer, contract.address);
    const tx = await run();
    if (tx instanceof Error) throw tx;

  const { address: consumerAddress } = await consumer.login();
  const [tx] = await consumer
    .transfer({
      amount: '10000000',
      recipient: '3N7gZxfwxYYvkiUqLtA5knWhxNHqZPbRujM',
    })
    .broadcast();

  await container.model
    .automateService()
    .createTransaction<WavesAutomateTransaction>(contract, consumerAddress, {
      id: tx.id,
      recipient: tx.recipient,
      type: tx.type,
    });
    */
};
