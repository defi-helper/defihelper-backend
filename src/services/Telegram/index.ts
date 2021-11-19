import * as Mustache from 'mustache';
import TelegramBot from 'node-telegram-bot-api';
import container from '@container';
import { ContactStatus } from '@models/Notification/Entity';
import { Templates } from './templates';

export type TelegramTemplate = keyof typeof Templates;

export class TelegramService {
  protected bot: TelegramBot;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: !!token });
  }

  startHandler() {
    this.bot.on('error', async (error) => {
      container.logger().error(`Error in TG. Message: Error: ${error.message}`);
    });

    this.bot.on('message', async (message) => {
      try {
        if (message.text && message.text.indexOf('/start') > -1) {
          const confirmationCode = message.text.replace('/start ', '');
          const userContact = await container.model
            .userContactTable()
            .where('confirmationCode', confirmationCode)
            .first();
          if (!userContact || userContact.status === ContactStatus.Active) {
            await this.bot.sendMessage(
              message.chat.id,
              'Please use https://defihelper.io to register',
            );
            return;
          }

          await container.model
            .userContactService()
            .activate(userContact, message.from?.username || '', {
              chatId: message.chat.id.toString(),
            });
          const user = await container.model.userTable().where('id', userContact.user).first();

          await container.model.queueService().push('sendTelegram', {
            chatId: message.chat.id,
            template: 'welcomeTemplate',
            params: {},
            locale: user?.locale || 'enUS',
          });
        }
      } catch (error) {
        container
          .logger()
          .error(`Error handling TG message. Message: ${JSON.stringify(message)}, error: ${error}`);
      }
    });
  }

  async send(template: TelegramTemplate, data: Object, chatId: number): Promise<void> {
    const message = Mustache.render(await Templates[template], data);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }
}

export function telegramServiceFactory(token: string) {
  return () => new TelegramService(token);
}
