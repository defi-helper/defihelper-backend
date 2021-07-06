import { Container, singleton } from '@services/Container';

export interface Config {
  mainNode: string;
  testNode: string;
}

export class BlockchainContainer extends Container<Config> {
  readonly provider = {
    main: singleton(() => this.parent.mainNode),
    test: singleton(() => this.parent.testNode),
  };
}
