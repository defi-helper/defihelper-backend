import * as Mustache from 'mustache';
import { Factory } from '@services/Container';
import { Telegraf } from 'telegraf';
import { I18nContainer, Locale } from '@services/I18n/container';
import { TemplateContainer } from '@services/Template/container';
import { Templates } from './templates';

export type TelegramTemplate = keyof typeof Templates;

export interface ITelegramService {
  send(template: TelegramTemplate, data: Object, chatId: number, locale?: Locale): Promise<void>;

  // eslint-disable-next-line
  getBot(): Telegraf | null;
}

class NullService implements ITelegramService {
  // eslint-disable-next-line
  async send() {}

  // eslint-disable-next-line
  getBot() {
    return null;
  }
}

export class TelegramService implements ITelegramService {
  protected bot: Telegraf;

  private isLaunched: boolean = false;

  constructor(
    token: string,
    protected readonly template: TemplateContainer,
    protected readonly i18n: I18nContainer,
  ) {
    this.bot = new Telegraf(token);
  }

  getBot() {
    if (!this.isLaunched) {
      this.bot.launch();
      this.isLaunched = true;
    }

    return this.bot;
  }

  async send(
    template: TelegramTemplate,
    data: Object,
    chatId: number,
    locale: Locale = 'enUS',
  ): Promise<void> {
    const message = Mustache.render(await Templates[template], {
      data,
      ...this.template.i18n(this.i18n.byLocale(locale)),
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
