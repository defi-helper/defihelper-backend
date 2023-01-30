import container from '@container';
import { Contract, ContractVerificationStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

async function reject(contract: Contract, rejectReason: string) {
  return container.model.automateService().updateContract({
    ...contract,
    verification: ContractVerificationStatus.Rejected,
    rejectReason: rejectReason.slice(0, 512),
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

  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, contract.wallet)
    .first();
  if (!blockchainWallet) throw new Error('Wallet not found');

  const { ethereum } = container.blockchain;
  const network = ethereum.byNetwork(blockchainWallet.network);
  const provider = network.provider();
  const contracts = network.dfhContracts();
  if (contracts === null) {
    await reject(contract, 'Network not supported');
    return process.done();
  }
  const erc1167Address = contracts.ERC1167?.address;
  if (erc1167Address === undefined) {
    throw new Error('ERC1167 library not deployed on target network');
  }

  const automate = ethereum.contract(contract.address, ethereum.abi.automateABI, provider);
  try {
    const owner = await automate.owner();
    if (owner.toLowerCase() !== blockchainWallet.address.toLowerCase()) {
      await reject(contract, 'Invalid owner');
      return process.done();
    }
  } catch (e) {
    if (String(e).indexOf('missing response') !== -1 && process.task.attempt < 5) {
      return process.laterAt(30, 'seconds');
    }

    await reject(contract, `${e}`);
    return process.done();
  }

  const erc1167 = ethereum.contract(erc1167Address, ethereum.abi.erc1167ABI, provider);
  try {
    const expectedPrototype = await container.blockchainAdapter.loadEthereumAutomateArtifact(
      blockchainWallet.network,
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
    if (String(e).indexOf('missing response') !== -1 && process.task.attempt < 5) {
      return process.laterAt(30, 'seconds');
    }

    await reject(contract, `${e}`);
    return process.done();
  }

  return process.done();
};
