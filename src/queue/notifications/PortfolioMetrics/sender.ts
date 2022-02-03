import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { DataLoaderContainer } from '@api/dataLoader/container';
import BN from 'bignumber.js';
import { TokenAliasLiquidity } from '@models/Token/Entity';

export default async (process: Process) => {
  const { userId } = process.task.params as { userId: string };

  const user = await container.model.userTable().where({ id: userId }).first();
  if (!user) {
    throw new Error('User not found');
  }

  const dataLoader = new DataLoaderContainer({});
  const contacts = await container.model.userContactTable().where({
    user: user.id,
    broker: ContactBroker.Telegram,
    status: ContactStatus.Active,
  });

  await Promise.all(
    contacts.map(async (contact) => {
      const chatId = contact.params?.chatId;
      if (!chatId) return null;

      const [totalStackedUSD, totalEarnedUSD, totalTokensUSD] = await Promise.all([
        dataLoader.userMetric({ metric: 'stakingUSD' }).load(user.id),
        dataLoader.userMetric({ metric: 'earnedUSD' }).load(user.id),
        dataLoader
          .userTokenMetric({
            contract: null,
            tokenAlias: { liquidity: [TokenAliasLiquidity.Stable, TokenAliasLiquidity.Unstable] },
          })
          .load(user.id),
      ]);

      if (!totalStackedUSD) return null;

      return container.model.queueService().push('sendTelegram', {
        chatId,
        locale: user.locale,
        params: {
          totalNetWorth: new BN(totalStackedUSD)
            .plus(totalEarnedUSD)
            .plus(totalTokensUSD)
            .toFixed(2),
          totalEarnedUSD: new BN(totalEarnedUSD).toFixed(2),
        },
        template: 'portfolioMetrics',
      });
    }),
  );

  return process.done();
};
