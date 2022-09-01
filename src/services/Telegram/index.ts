import * as Mustache from 'mustache';
import container from '@container';
import { Factory } from '@services/Container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { Telegraf } from 'telegraf';
import { I18nContainer, Locale } from '@services/I18n/container';
import { utils } from 'ethers';
import {
  walletBlockchainTableName,
  WalletBlockchainType,
  walletTableName,
} from '@models/Wallet/Entity';
import { Role } from '@models/User/Entity';
import { TemplateContainer } from '@services/Template/container';
import { Templates } from './templates';

export type TelegramTemplate = keyof typeof Templates;

export interface ITelegramService {
  startHandler(): void;

  send(template: TelegramTemplate, data: Object, chatId: number, locale?: Locale): Promise<void>;
}

class NullService implements ITelegramService {
  // eslint-disable-next-line
  startHandler() {}

  // eslint-disable-next-line
  async send() {}
}

export class TelegramService implements ITelegramService {
  protected bot: Telegraf;

  protected template: TemplateContainer;

  protected i18n: I18nContainer;

  constructor(token: string, template: TemplateContainer, i18n: I18nContainer) {
    this.template = template;
    this.i18n = i18n;

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
        return this.send('welcomeTemplate', {}, message.chat.id, user?.locale || 'enUS');
      }

      return this.send('welcomeNewWalletConnect', {}, message.chat.id, 'enUS');
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

      const user = await container.model.userService().create(Role.User, 'UTC');
      await container.model
        .walletService()
        .createBlockchainWallet(
          user,
          'ethereum',
          '1',
          WalletBlockchainType.Wallet,
          inputAddress,
          '',
          '',
          false,
        );

      const username = ctx.message.from?.username || '';
      const existingContact = await container.model
        .userContactTable()
        .whereRaw(`params->>'chatId' = '${ctx.chat.id}'`)
        .first();

      if (existingContact) {
        await Promise.all([
          container.model.userContactService().activate(existingContact, username, {
            chatId: String(ctx.chat.id),
          }),
          container.model.userContactService().update({
            ...existingContact,
            user: user.id,
          }),
        ]);
      }

      const contact = await container.model
        .userContactService()
        .create(ContactBroker.Telegram, username, user, 'Telegram account');

      await container.model.userContactService().activate(contact, username, {
        chatId: String(ctx.chat.id),
      });

      return ctx.reply(
        "Great work! Everything's done, now you can use the app at https://app.defihelper.io",
      );
    });
  }

  async send(
    template: TelegramTemplate,
    data: Object,
    chatId: number,
    locale: Locale = 'enUS',
  ): Promise<void> {
    const message = Mustache.render(await Templates[template], {
      data,
      ...container.template.i18n(container.i18n.byLocale(locale)),
    });

    await this.bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }
}

export function telegramServiceFactory(
  token: string,
  template: TemplateContainer,
  i18n: I18nContainer,
): Factory<ITelegramService> {
  return () => (token ? new TelegramService(token, template, i18n) : new NullService());
}
