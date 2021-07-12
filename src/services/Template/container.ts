import { Container, singleton } from '@services/Container';
import AppContainer from '@container';
import { i18nContext } from './index';
import * as Mustache from 'mustache';

export class TemplateContainer extends Container<typeof AppContainer> {
  readonly i18n = i18nContext;

  readonly render = (template: string, data: any | typeof Mustache.Context) =>
    Mustache.render(template, data);
}
