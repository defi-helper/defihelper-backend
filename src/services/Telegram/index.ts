import * as Mustache from 'mustache';
import container from '@container';
import { Factory } from '@services/Container';
import { ContactStatus } from '@models/Notification/Entity';
import { Telegraf } from 'telegraf';
import { Locale } from '@services/I18n/container';
import { utils } from 'ethers';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { Templates } from './templates';

export type TelegramTemplate = keyof typeof Templates;

export interface ITelegramService {
  startHandler(): void;

  send(template: TelegramTemplate, chatId: number, data: Object, locale: Locale): Promise<void>;
}

class NullService implements ITelegramService {
  // eslint-disable-next-line
  startHandler() {}

  // eslint-disable-next-line
  async send() {}
}

export class TelegramService implements ITelegramService {
  protected bot: Telegraf;

  constructor(token: string) {
    this.bot = new Telegraf(token);
  }

  startHandler() {
    this.bot.launch();

    this.bot.start(async ({ message }) => {
      const confirmationCode = message.text.replace('/start ', '');
      const userContact = await container.model
        .userContactTable()
        .where('confirmationCode', confirmationCode)
        .first();

      if (userContact && userContact.status !== ContactStatus.Active) {
        await container.model
          .userContactService()
          .activate(userContact, message.from?.username || '', {
            chatId: message.chat.id.toString(),
          });
        const user = await container.model.userTable().where('id', userContact.user).first();
        return this.send('welcomeTemplate', message.chat.id, {}, user?.locale || 'enUS');
      }

      return this.send('walletConnectWelcome', message.chat.id, {}, 'enUS');
    });

    this.bot.on('text', async (ctx) => {
      if (!utils.isAddress(ctx.message.text)) {
        return ctx.reply(
          'Right now, I understand only Ethereum addresses(ex. 0xc1912fee45d61c87cc5ea59dae31190fffff232d) :(',
        );
      }

      const inputAddress = ctx.message.text.toLowerCase();
      const foundWallet = await container.model
        .walletTable()
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where(`${walletBlockchainTableName}.address`, inputAddress)
        .first();

      if (foundWallet) {
        return ctx.reply(
          'You already have an account, please login at https://app.defihelper.io :sowwy:',
        );
      }

      return ctx.reply('adsasdsd');
    });
  }

  async send(
    template: TelegramTemplate,
    chatId: number,
    data: Object = {},
    locale: Locale = 'enUS',
  ): Promise<void> {
    const message = Mustache.render(await Templates[template], {
      data,
      ...container.template.i18n(container.i18n.byLocale(locale)),
    });

    try {
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
      });
    } catch {
      console.error('unable to reply');
    }
  }
}

export function telegramServiceFactory(token: string): Factory<ITelegramService> {
  return () => (token ? new TelegramService(token) : new NullService());
}
