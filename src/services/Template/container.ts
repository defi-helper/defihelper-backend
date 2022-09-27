import { Container } from '@services/Container';
import AppContainer from '@container';
import * as Mustache from 'mustache';
import { i18nContext } from './index';

export class TemplateContainer extends Container<typeof AppContainer> {
  readonly i18n = i18nContext;

  readonly render = (template: string, data: any | typeof Mustache.Context) => {
    return Mustache.render(template, {
      ...data,
      formatMoney: () => (text: string, render: any) =>
        this.parent.numbers().formatMoney(render(text)),
    });
  };
}
