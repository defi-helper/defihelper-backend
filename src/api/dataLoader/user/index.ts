import container from '@container';
import DataLoader from 'dataloader';

export const userBlockchainLoader = () =>
  new DataLoader(async (usersId: ReadonlyArray<string>) => {
    const blockchains = await container.model
      .walletTable()
      .columns('user', 'blockchain', 'network')
      .whereIn('user', usersId)
      .groupBy('user', 'blockchain', 'network');

    return usersId.map((userId) => blockchains.filter(({ user }) => user === userId));
  });
