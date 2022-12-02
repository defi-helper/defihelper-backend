import * as Mustache from 'mustache';
import { I18nContainer, Locale } from '@services/I18n/container';
import { Numbers } from '@services/Numbers';

export class TemplateRender {
  constructor(public readonly i18n: I18nContainer, public readonly numbers: Numbers) {}

  render(template: string, data: any | typeof Mustache.Context, locale: Locale = 'enUS') {
    return Mustache.render(template, {
      ...data,
      t: () => (text: string, render: any) => {
        return render(this.i18n.byLocale(locale).t(text));
      },
      p: () => (text: string, render: any) => {
        const [n] = render(text);
        return render(this.i18n.byLocale(locale).p(parseFloat(n), text));
      },
      formatMoney: () => (text: string, render: any) => this.numbers.formatMoney(render(text)),
    });
  }
}
