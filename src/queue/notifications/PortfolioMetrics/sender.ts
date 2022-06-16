import { Process } from '@models/Queue/Entity';
import container from '@container';
import { DataLoaderContainer } from '@api/dataLoader/container';
import BN from 'bignumber.js';
import { TokenAliasLiquidity } from '@models/Token/Entity';

interface Params {
  notificationId: string;
}

export default async (process: Process) => {
  const { notificationId } = process.task.params as Params;

  const notificationSetting = await container.model
    .userNotificationTable()
    .where({ id: notificationId })
    .first();
  if (!notificationSetting || !notificationSetting.contact) {
    throw new Error('NotificationSetting not found');
  }

  const dataLoader = new DataLoaderContainer({});
  const contact = await container.model
    .userContactTable()
    .where({
      id: notificationSetting.contact,
    })
    .first();

  if (!contact) {
    throw new Error('NotificationSetting not found');
  }

  const user = await container.model
    .userTable()
    .where({
      id: contact.user,
    })
    .first();

  if (!user) {
    throw new Error('User not found');
  }

  const chatId = contact.params?.chatId;
  if (!chatId) return null;

  const [totalStackedUSD, totalEarnedUSD, totalTokensUSD] = await Promise.all([
    dataLoader.userMetric({ metric: 'stakingUSD' }).load(contact.user),
    dataLoader.userMetric({ metric: 'earnedUSD' }).load(contact.user),
    dataLoader
      .userTokenMetric({
        contract: null,
        tokenAlias: { liquidity: [TokenAliasLiquidity.Stable, TokenAliasLiquidity.Unstable] },
      })
      .load(contact.user),
  ]);

  if (!totalStackedUSD) return null;

  await container.model.queueService().push('sendTelegram', {
    chatId,
    locale: user.locale,
    params: {
      totalNetWorth: new BN(totalStackedUSD).plus(totalEarnedUSD).plus(totalTokensUSD).toFixed(2),
      totalEarnedUSD: new BN(totalEarnedUSD).toFixed(2),
    },
    template: 'portfolioMetrics',
  });

  return process.done();
};
