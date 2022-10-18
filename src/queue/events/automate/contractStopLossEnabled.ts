import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenCreatedBy } from '@models/Token/Entity';

async function createToken(network: string, tokenAddress: string) {
  let token = await container.model
    .tokenTable()
    .where('blockchain', 'ethereum')
    .where('network', network)
    .where('address', tokenAddress.toLowerCase())
    .first();
  if (!token) {
    token = await container.model
      .tokenService()
      .create(
        null,
        'ethereum',
        network,
        tokenAddress.toLowerCase(),
        '',
        '',
        0,
        TokenCreatedBy.AutomateContractStopLoss,
      );
  }

  return token;
}

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const stopLoss = await container.model.automateContractStopLossTable().where('id', id).first();
  if (!stopLoss) {
    throw new Error('Automate contract stop loss not found');
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

  const stopLossUpdated = {
    ...stopLoss.stopLoss,
  };
  if (stopLoss.stopLoss.inToken === null) {
    stopLossUpdated.inToken = await createToken(
      ownerWallet.network,
      stopLoss.stopLoss.path[0],
    ).then((token) => token.id);
  }
  if (stopLoss.stopLoss.outToken === null) {
    stopLossUpdated.outToken = await createToken(
      ownerWallet.network,
      stopLoss.stopLoss.path[stopLoss.stopLoss.path.length - 1],
    ).then((token) => token.id);
  }

  await container.model.automateService().updateStopLoss({
    ...stopLoss,
    stopLoss: stopLossUpdated,
  });

  return process.done();
};
