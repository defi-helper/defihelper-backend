export interface Messages {
  [m: string]: string | string[];
}

export type Plural = (n: number) => number;

export class I18n {
  constructor(
    public readonly messages: Messages = messages,
    public readonly plural: Plural = plural,
  ) {}

  t(m: string) {
    return (this.messages[m] ?? m).toString();
  }

  p(n: number, m: string) {
    return (this.messages[m][this.plural(n)] ?? m).toString();
  }
}
