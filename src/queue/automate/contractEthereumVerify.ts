import container from '@container';
import { Contract, ContractVerificationStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';

async function reject(contract: Contract, rejectReason: string) {
  return container.model.automateService().updateContract({
    ...contract,
    verification: ContractVerificationStatus.Rejected,
    rejectReason,
  });
}

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const automateService = container.model.automateService();
  const contract = await automateService.contractTable().where('id', id).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.verification !== ContractVerificationStatus.Pending) return process.done();

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const wallet = await container.model.walletTable().where('id', contract.wallet).first();
  if (!wallet) throw new Error('Wallet not found');

  const { ethereum } = container.blockchain;
  const network = ethereum.byNetwork(contract.network);
  const provider = network.provider();
  const contracts = network.dfhContracts();
  if (contracts === null) {
    await reject(contract, 'Network not supported');
    return process.done();
  }

  const automate = ethereum.contract(contract.address, ethereum.abi.automateABI, provider);
  try {
    const owner = await automate.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      await reject(contract, 'Invalid owner');
      return process.done();
    }
  } catch (e) {
    await reject(contract, e.message);
    return process.done();
  }

  const erc1167 = ethereum.contract(contracts.ERC1167.address, ethereum.abi.erc1167ABI, provider);
  try {
    const expectedPrototype = await container.blockchainAdapter.loadEthereumAutomateArtifact(
      contract.network,
      protocol.adapter,
      contract.adapter,
    );
    if (expectedPrototype.address === undefined) {
      await reject(contract, 'Prototype not deployed');
      return process.done();
    }

    const prototype = await erc1167.implementation(contract.address);
    if (prototype.toLowerCase() !== expectedPrototype.address.toLowerCase()) {
      await reject(contract, 'Invalid prototype');
      return process.done();
    }

    await automateService.updateContract({
      ...contract,
      verification: ContractVerificationStatus.Confirmed,
    });
  } catch (e) {
    await reject(contract, e.message);
    return process.done();
  }

  return process.done();
};
