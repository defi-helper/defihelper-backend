import container from '@container';
import { Contract, ContractVerificationStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

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

  const contract = await container.model.automateContractTable().where('id', id).first();
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

  const { waves } = container.blockchain;
  const network = waves.byNetwork(blockchainWallet.network);

  try {
    const { script } = await network.node.addresses.scriptInfo(contract.address);
    if (!script) {
      await reject(contract, 'Script not deployed');
      return process.done();
    }

    const expectedPrototype = await container.blockchainAdapter.loadWavesAutomateArtifact(
      protocol.adapter,
      contract.adapter,
    );
    if (`base64:${expectedPrototype.base64}` !== script) {
      await reject(contract, 'Invalid script');
      return process.done();
    }

    await container.model.automateService().updateContract({
      ...contract,
      verification: ContractVerificationStatus.Confirmed,
    });
    await container.model.queueService().push('eventsAutomateContractVerificationConfirmed', {
      contract: contract.id,
    });
  } catch (e) {
    await reject(contract, `${e}`);
    return process.done();
  }

  return process.done();
};
