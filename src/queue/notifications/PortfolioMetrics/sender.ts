import { Process } from '@models/Queue/Entity';
import container from '@container';
import { DataLoaderContainer } from '@api/dataLoader/container';
import BN from 'bignumber.js';
import { TokenAliasLiquidity } from '@models/Token/Entity';
import {
  ContactBroker,
  ContactStatus,
  NotificationStatus,
  NotificationType,
} from '@models/Notification/Entity';

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
      status: ContactStatus.Active,
    })
    .first();

  if (!contact) {
    throw new Error('Contact not found');
  }

  const user = await container.model.userTable().where({ id: contact.user }).first();
  if (!user) {
    throw new Error('User not found');
  }
  const availableNotifications = await container.model.storeService().availableNotifications(user);
  if (availableNotifications <= 0) {
    throw new Error('Not available notifications');
  }

  const chatId = contact.params?.chatId;
  if (!chatId) return process.error(new Error('Chat id not found'));

  const [
    {
      stakingUSD: totalStackedUSD,
      earnedUSD: totalEarnedUSD,
      /*
      earnedUSDDayBefore,
      stakingUSDDayBefore,
      */
    },
    {
      usd: totalTokensUSD,
      // usdDayBefore
    },
  ] = await Promise.all([
    dataLoader.userMetric().load(contact.user),
    dataLoader
      .userTokenMetric({
        contract: null,
        tokenAlias: { liquidity: [TokenAliasLiquidity.Stable, TokenAliasLiquidity.Unstable] },
      })
      .load(contact.user),
  ]);
  if (!totalStackedUSD) {
    return process.done().info('no totalStackedUSD');
  }

  const totalNetWorth = new BN(totalStackedUSD).plus(totalEarnedUSD).plus(totalTokensUSD);
  /*
  const worthDayBefore = new BN(stakingUSDDayBefore).plus(earnedUSDDayBefore).plus(usdDayBefore);
  const worthChange = !worthDayBefore.eq(0)
    ? new BN(totalNetWorth).minus(worthDayBefore).div(worthDayBefore).multipliedBy(100)
    : new BN(0);
  const earnedChange = !new BN(earnedUSDDayBefore).eq(0)
    ? new BN(totalEarnedUSD).minus(earnedUSDDayBefore).div(earnedUSDDayBefore).multipliedBy(100)
    : new BN(0);
  */

  const templateParams = {
    name: user.name === '' ? 'My Portfolio' : user.name,
    totalNetWorth: totalNetWorth.toFixed(2),
    totalEarnedUSD: new BN(totalEarnedUSD).toFixed(2),
    /*
    percentageEarned: `${earnedChange.isPositive() ? '+' : ''}${earnedChange.toFixed(2)}`,
    percentageTracked: `${worthChange.isPositive() ? '+' : ''}${worthChange.toFixed(2)}`,
    */
  };

  switch (contact.broker) {
    case ContactBroker.Telegram:
      await container.model.queueService().push('sendTelegramByContact', {
        contactId: contact.id,
        template: 'portfolioMetrics',
        params: templateParams,
      });
      break;
    case ContactBroker.Email:
      await container
        .email()
        .send(
          'PortfolioMetrics',
          templateParams,
          'Portfolio statistics',
          contact.address,
          user.locale,
        );
      break;
    default:
      throw new Error('Unknown broker');
  }
  await container.model
    .notificationService()
    .create(
      contact,
      { type: NotificationType.portfolioMetrics, payload: {} },
      NotificationStatus.processed,
    );

  return process.done();
};
