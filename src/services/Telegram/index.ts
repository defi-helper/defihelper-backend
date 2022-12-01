import { Factory } from '@services/Container';
import { Telegraf } from 'telegraf';
import { I18nContainer, Locale } from '@services/I18n/container';
import { TemplateRender } from '@services/Template';
import { Templates } from './templates';

export type TelegramTemplate = keyof typeof Templates;

export interface ITelegramService {
  send(template: TelegramTemplate, data: Object, chatId: number, locale?: Locale): Promise<void>;

  // eslint-disable-next-line
  getBot(): Telegraf | null;
}

class NullService implements ITelegramService {
  constructor(
    protected readonly template: TemplateRender,
    protected readonly i18n: I18nContainer,
  ) {}

  // eslint-disable-next-line
  async send(template: TelegramTemplate, data: Object, chatId: number, locale: Locale = 'enUS') {
    console.info(this.template.render(await Templates[template], data, locale));
  }

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
    protected readonly template: TemplateRender,
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
    const message = this.template.render(await Templates[template], data, locale);

    await this.bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }
}

export function telegramServiceFactory(
  token: string,
  template: TemplateRender,
  i18n: I18nContainer,
): Factory<ITelegramService> {
  return () =>
    token ? new TelegramService(token, template, i18n) : new NullService(template, i18n);
}
