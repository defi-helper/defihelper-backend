import dayjs from 'dayjs';
import BN from 'bignumber.js';
import container from '@container';
import { UserCollectorStatus } from '@models/Metric/Entity';
import { User, tableName as userTableName } from '@models/User/Entity';
import { Process, TaskStatus } from '@models/Queue/Entity';
import { DataLoaderContainer } from '@api/dataLoader/container';
import {
  UserNotification,
  userNotificationTableName,
  UserNotificationType,
} from '@models/UserNotification/Entity';
import {
  ContactBroker,
  ContactStatus,
  UserContact,
  userContactTableName,
} from '@models/Notification/Entity';
import { TokenAliasLiquidity } from '@models/Token/Entity';
import { LogJsonMessage } from '@services/Log';

const log = LogJsonMessage.debug({ source: 'eventsMetricUserCollected' });

async function sendPortfolioNotification(user: User) {
  const notifications: Array<UserNotification & UserContact> = await container.model
    .userNotificationTable()
    .columns(`${userNotificationTableName}.*`)
    .columns(`${userContactTableName}.*`)
    .innerJoin(
      userContactTableName,
      `${userNotificationTableName}.contact`,
      `${userContactTableName}.id`,
    )
    .innerJoin(userTableName, `${userContactTableName}.user`, `${userTableName}.id`)
    .where(`${userTableName}.id`, user.id)
    .where(`${userContactTableName}.status`, ContactStatus.Active)
    .where(`${userNotificationTableName}.type`, UserNotificationType.PortfolioMetrics);
  log.ex({ notificationsCount: notifications.length }).send();
  if (notifications.length === 0) return;

  const dataLoader = new DataLoaderContainer({});
  const [
    {
      stakingUSD: totalStackedUSD,
      earnedUSD: totalEarnedUSD,
      earnedUSDDayBefore,
      stakingUSDDayBefore,
    },
    { usd: totalTokensUSD, usdDayBefore },
  ] = await Promise.all([
    dataLoader.userMetric().load(user.id),
    dataLoader
      .userTokenMetric({
        contract: null,
        tokenAlias: { liquidity: [TokenAliasLiquidity.Stable, TokenAliasLiquidity.Unstable] },
      })
      .load(user.id),
  ]);
  if (!totalStackedUSD) return;

  const totalNetWorth = new BN(totalStackedUSD).plus(totalEarnedUSD).plus(totalTokensUSD);
  const worthDayBefore = new BN(stakingUSDDayBefore).plus(earnedUSDDayBefore).plus(usdDayBefore);
  const worthChange = !worthDayBefore.eq(0)
    ? new BN(totalNetWorth).minus(worthDayBefore).div(worthDayBefore).multipliedBy(100)
    : new BN(0);
  const earnedChange = !new BN(earnedUSDDayBefore).eq(0)
    ? new BN(totalEarnedUSD).minus(earnedUSDDayBefore).div(earnedUSDDayBefore).multipliedBy(100)
    : new BN(0);
  const templateParams = {
    name: user.name === '' ? 'My Portfolio' : user.name,
    time: dayjs().format('YYYY-MM-DD HH:mm'),
    totalNetWorth: totalNetWorth.toFixed(2),
    totalEarnedUSD: new BN(totalEarnedUSD).toFixed(2),
    percentageEarned: `${earnedChange.isPositive() ? '+' : ''}${earnedChange.toFixed(2)}`,
    percentageTracked: `${worthChange.isPositive() ? '+' : ''}${worthChange.toFixed(2)}`,
  };
  log.ex({ templateParams }).send();

  await notifications.reduce<Promise<unknown>>(async (prev, notification) => {
    await prev;

    let sendDate = dayjs.tz(`${dayjs().format('YYYY-MM-DD')} ${notification.time}`, user.timezone);
    if (sendDate.add(1, 'hour').isBefore(dayjs())) {
      sendDate = sendDate.add(1, 'day');
    }
    log
      .ex({
        contactId: notification.id,
        broker: notification.broker,
        sendDate: `${sendDate.toDate()}`,
      })
      .send();
    if (notification.broker === ContactBroker.Telegram) {
      return container.model.queueService().push(
        'sendTelegramByContact',
        {
          contactId: notification.id,
          template: 'portfolioMetrics',
          params: templateParams,
        },
        { startAt: sendDate.toDate() },
      );
    }
    if (notification.broker === ContactBroker.Email) {
      return container.model.queueService().push(
        'sendEmail',
        {
          email: notification.address,
          template: 'portfolioMetrics',
          subject: 'Portfolio statistics',
          params: templateParams,
          locale: user.locale,
        },
        { startAt: sendDate.toDate() },
      );
    }

    return null;
  }, Promise.resolve(null));
}

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  log.ex({ userCollectorId: id }).send();

  const collector = await container.model.metricUserCollectorTable().where('id', id).first();
  if (!collector) {
    throw new Error('Metric collector not found');
  }
  if (collector.status === UserCollectorStatus.Done) {
    return process.done();
  }

  const user = await container.model.userTable().where('id', collector.user).first();
  if (!user) {
    throw new Error('User not found');
  }

  const notCompletedTasks = await container.model
    .queueTable()
    .count({ count: 'id' })
    .whereIn('id', collector.data.tasks)
    .whereIn('status', [TaskStatus.Pending, TaskStatus.Process])
    .first()
    .then((row) => Number(row?.count ?? '0'));
  log.ex({ notCompletedTasks }).send();
  if (notCompletedTasks > 0) {
    return process.later(dayjs().add(10, 'minutes').toDate());
  }
  await container.model.metricService().doneUserCollector(collector);

  await sendPortfolioNotification(user);

  return process.done();
};
