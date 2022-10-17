import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const token = await container.model.tokenTable().where({ id }).first();

  if (!token) {
    throw new Error('No token found');
  }

  if (token.coingeckoId) {
    throw new Error('Coingecko id already exists');
  }

  const platform = container.blockchain.ethereum.byNetwork(token.network).coingeckoPlatform;
  if (!platform) {
    throw new Error('Unknown target platform');
  }

  const coin = await container.coingecko().findCoinByAddress(platform, token.address);

  if (!coin) {
    return process.done().info('no coin found');
  }

  await container.model.tokenService().update({
    ...token,
    coingeckoId: coin.id,
  });

  return process.done();
};
