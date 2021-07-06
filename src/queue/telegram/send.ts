import { Process } from "@models/Queue/Entity";
import container from "@container";
import { TelegramTemplate } from "@services/Telegram";

export interface TelegramNotification {
  chatId: number;
  template: TelegramTemplate;
  params: Object;
}

export default async (process: Process) => {
  const telegramNotification = process.task.params as TelegramNotification;
  
  await container.telegram().send(
    telegramNotification.template,
    telegramNotification.params,
    telegramNotification.chatId,
  );

  return process.done();
};
