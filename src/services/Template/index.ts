import { I18n } from '@services/I18n';

export const i18nContext = (i18n: I18n) => ({
  t: () => (text: string, render: any) => {
    return render(i18n.t(text));
  },
  p: () => (text: string, render: any) => {
    const [n] = render(text);

    return render(i18n.p(parseFloat(n), text));
  },
});
