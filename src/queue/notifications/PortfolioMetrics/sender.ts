import { Process, TaskStatus } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { DataLoaderContainer } from '@api/dataLoader/container';
import BN from 'bignumber.js';
import { TokenAliasLiquidity } from '@models/Token/Entity';
import dayjs from 'dayjs';

interface Params {
  userId: string;
  wait: string[];
}

export default async (process: Process) => {
  const { userId, wait } = process.task.params as Params;

  const user = await container.model.userTable().where({ id: userId }).first();
  if (!user) {
    throw new Error('User not found');
  }

  const completedTasksCount = await container.model
    .queueTable()
    .count()
    .whereIn('id', wait)
    .andWhere('status', TaskStatus.Done)
    .first()
    .then((row) => Number(row?.count ?? '0'));
  if (completedTasksCount < wait.length) {
    return process.later(dayjs().add(5, 'minutes').toDate());
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
