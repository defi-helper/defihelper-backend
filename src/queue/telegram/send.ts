import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TelegramTemplate } from '@services/Telegram';
import { Locale } from '@services/I18n/container';

export interface TelegramNotification {
  chatId: number;
  template: TelegramTemplate;
  params: Object;
  locale: Locale;
}

export default async (process: Process) => {
  const { template, params, chatId, locale } = process.task.params as TelegramNotification;

  await container.telegram().send(
    template,
    {
      ...container.template.i18n(container.i18n.byLocale(locale)),
      ...params,
    },
    chatId,
  );

  return process.done();
};
