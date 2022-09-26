import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenCreatedBy } from '@models/Token/Entity';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const stopLoss = await container.model.automateContractStopLossTable().where('id', id).first();
  if (!stopLoss) {
    throw new Error('Automate contract stop loss not found');
  }
  if (stopLoss.stopLoss.outToken !== null) {
    return process.done();
  }

  const contract = await container.model
    .automateContractTable()
    .where('id', stopLoss.contract)
    .first();
  if (!contract) {
    throw new Error('Automate contract not found');
  }

  const ownerWallet = await container.model
    .walletBlockchainTable()
    .where('id', contract.wallet)
    .first();
  if (!ownerWallet) {
    throw new Error('Wallet not found');
  }
  if (ownerWallet.blockchain !== 'ethereum') {
    throw new Error('Ethereum blockchain supported only');
  }

  const outTokenAddress = stopLoss.stopLoss.path[stopLoss.stopLoss.path.length - 1];
  let token = await container.model
    .tokenTable()
    .where('blockchain', 'ethereum')
    .where('network', ownerWallet.network)
    .where('address', outTokenAddress.toLowerCase())
    .first();
  if (!token) {
    token = await container.model
      .tokenService()
      .create(
        null,
        'ethereum',
        ownerWallet.network,
        outTokenAddress.toLowerCase(),
        '',
        '',
        0,
        TokenCreatedBy.AutomateContractStopLoss,
      );
  }

  await container.model.automateService().updateStopLoss({
    ...stopLoss,
    stopLoss: {
      ...stopLoss.stopLoss,
      outToken: token.id,
    },
  });

  return process.done();
};
