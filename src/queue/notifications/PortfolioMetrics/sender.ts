import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker } from '@models/Notification/Entity';
import { DataLoaderContainer } from '@api/dataLoader/container';

export default async (process: Process) => {
  const { userId } = process.task.params as { userId: string };

  const user = await container.model.userTable().where({ id: userId }).first();
  if (!user) {
    throw new Error('User not found');
  }

  const contacts = await container.model.userContactTable().where({
    user: user.id,
    broker: ContactBroker.Telegram,
  });

  const dataLoader = new DataLoaderContainer({});
  for (const contact of contacts) {
    const chatId = contact.params?.chatId;

    if (!chatId) {
      continue;
    }

    const totalStackedUSD = await dataLoader.userMetric({ metric: 'stakingUSD' }).load(user.id);
    const totalEarnedUSD = await dataLoader.userMetric({ metric: 'stakingUSD' }).load(user.id);

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
