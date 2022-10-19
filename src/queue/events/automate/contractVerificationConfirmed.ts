import container from '@container';
import { ContractVerificationStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

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
  if (!contract.contract) return process.done();

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const targetContract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contract.contract)
    .first();
  if (!targetContract) throw new Error('Target contract not found');

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

  const user = await container.model.userTable().where('id', blockchainWallet.user).first();
  if (!user) throw new Error('User not found');

  const contractWallet = await container.model
    .walletService()
    .createBlockchainWallet(
      user,
      blockchainWallet.blockchain,
      blockchainWallet.network,
      WalletBlockchainType.Contract,
      targetContract.blockchain === 'ethereum' ? contract.address.toLowerCase() : contract.address,
      '',
      `Automate contract ${contract.address.slice(0, 5)}...`,
    );
  await Promise.all([
    container.model.contractService().walletLink(targetContract, contractWallet),
    container.model.automateService().updateContract({
      ...contract,
      contractWallet: contractWallet.id,
    }),
  ]);

  return process.done();
};
