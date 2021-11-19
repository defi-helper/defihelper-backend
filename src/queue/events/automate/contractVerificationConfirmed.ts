import container from '@container';
import { ContractVerificationStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import { WalletType } from '@models/Wallet/Entity';
import { EthereumAutomateAdapter } from '@services/Blockchain/Adapter';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract: contractId } = process.task.params as Params;

  const contract = await container.model.automateContractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.verification !== ContractVerificationStatus.Confirmed) {
    throw new Error('Invalid verification status');
  }

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const wallet = await container.model.walletTable().where('id', contract.wallet).first();
  if (!wallet) throw new Error('Wallet not found');

  const user = await container.model.userTable().where('id', wallet.user).first();
  if (!user) throw new Error('User not found');

  const network = container.blockchain.ethereum.byNetwork(wallet.network);
  const signer = network.consumers()[0];

  const adapters = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  if (!adapters.automates || typeof adapters.automates !== 'object')
    throw new Error('Automates adapters not found');
  const automateAdapterFactory = adapters.automates[contract.adapter] as EthereumAutomateAdapter;
  if (typeof automateAdapterFactory !== 'function') throw new Error('Automate adapter not found');

  const automateAdapter = await automateAdapterFactory(signer, contract.address);
  const { contract: targetContractAddress } = automateAdapter;

  const targetContract = await container.model
    .contractTable()
    .where({
      protocol: protocol.id,
      address: targetContractAddress.toLowerCase(),
    })
    .first();
  if (!targetContract) throw new Error('Target contract not found');

  const contractWallet = await container.model
    .walletService()
    .create(
      user,
      wallet.blockchain,
      wallet.network,
      WalletType.Contract,
      contract.address,
      '',
      `Automate contract ${contract.address.slice(0, 5)}...`,
    );
  await container.model.contractService().walletLink(targetContract, contractWallet);

  return process.done();
};
