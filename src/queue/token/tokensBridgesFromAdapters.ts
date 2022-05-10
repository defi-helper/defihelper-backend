import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenCreatedBy } from '@models/Token/Entity';

export default async (process: Process) => {
  const aliases = await container.blockchainAdapter.loadAliases();
  const tokenService = container.model.tokenService();
  const addedCount = await aliases.reduce<Promise<number>>(
    async (prev, { network, address, priceFeed }) => {
      const counter = await prev;

      const token = await container.model
        .tokenTable()
        .where('blockchain', 'ethereum')
        .andWhere('network', network)
        .andWhere('address', address.toLowerCase())
        .first();
      if (token) {
        await tokenService.update({ ...token, priceFeed });
      } else {
        await tokenService.create(
          null,
          'ethereum',
          network.toString(),
          address.toLowerCase(),
          '',
          '',
          0,
          TokenCreatedBy.Adapter,
          priceFeed,
        );
      }

      return counter + 1;
    },
    Promise.resolve(0),
  );

  container.logger().info(`Token price feeds: ${addedCount}/${aliases.length}`);

  return process.done();
};
