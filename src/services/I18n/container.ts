import { Container, singleton } from '@services/Container';
import AppContainer from '@container';
import { User } from '@models/User/Entity';
import { I18n } from './index';
import * as locales from '../../locales';

export type Locale = keyof typeof locales;

export class I18nContainer extends Container<typeof AppContainer> {
  readonly enUS = singleton(() => new I18n(locales.enUS.messages, locales.enUS.plural));

  readonly ruRU = singleton(() => new I18n(locales.ruRU.messages, locales.ruRU.plural));

  readonly byLocale = (locale: Locale) => this[locale]() ?? this.enUS();

  readonly byUser = (user?: User) => (user ? this.byLocale(user.locale) : this.enUS());
}
