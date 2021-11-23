import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker } from '@models/Notification/Entity';
import { DataLoaderContainer } from '@api/dataLoader/container';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const contacts = await container.model.userContactTable().where({
    broker: ContactBroker.Telegram,
  });

  const dataLoader = new DataLoaderContainer({});
  for (const contact of contacts) {
    const user = await container.model.userTable().where('id', contact.user).first();
    const chatId = contact.params?.chatId;

    if (!chatId || !user) {
      continue;
    }

    const walletsIds = (await container.model.walletTable().where('user', user.id)).map(
      (v) => v.id,
    );

    const stackedPerWallet: number[] = await Promise.all(
      walletsIds.map((id) => dataLoader.walletMetric({ metric: 'stakingUSD' }).load(id)),
    );

    const earnedPerWallet: number[] = await Promise.all(
      walletsIds.map((id) => dataLoader.walletMetric({ metric: 'stakingUSD' }).load(id)),
    );

    const totalStackedUSD = stackedPerWallet.reduce((a, value) => a + value, 0);
    const totalEarnedUSD = earnedPerWallet.reduce((a, value) => a + value, 0);

    await container.model.queueService().push('sendTelegram', {
      chatId,
      locale: user.locale,
      params: {
        totalStackedUSD,
        totalEarnedUSD,
      },
      template: 'portfolioMetrics',
    });
  }

  return process.done();
};
