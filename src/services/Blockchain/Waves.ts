import { Container, singleton } from '@services/Container';
import { isKey } from '@services/types';
import { fetchScriptInfo } from '@waves/node-api-js/cjs/api-node/addresses';

function nodeGatewayFactory(url: string) {
  return {
    addresses: {
      scriptInfo: fetchScriptInfo.bind(null, url),
    },
  };
}

export interface Config {
  mainNode: string;
  testNode: string;
}

export type Networks = keyof BlockchainContainer['networks'];

export class BlockchainContainer extends Container<Config> {
  readonly networks = {
    main: {
      name: 'Waves',
      provider: singleton(() => this.parent.mainNode),
      providerHistorical: singleton(() => this.parent.mainNode),
      node: nodeGatewayFactory('https://nodes.wavesnodes.com'),
      avgBlockTime: 60,
      txExplorerURL: new URL('https://wavesexplorer.com/tx'),
      walletExplorerURL: new URL('https://wavesexplorer.com/address'),
    },
    test: {
      name: 'Waves Test',
      provider: singleton(() => this.parent.testNode),
      providerHistorical: singleton(() => this.parent.testNode),
      node: nodeGatewayFactory('https://nodes-testnet.wavesnodes.com'),
      avgBlockTime: 60,
      txExplorerURL: new URL('https://testnet.wavesexplorer.com/tx'),
      walletExplorerURL: new URL('https://testnet.wavesexplorer.com/address'),
    },
  } as const;

  readonly isNetwork = (network: string | number): network is Networks => {
    return isKey(this.networks, network.toString());
  };

  readonly byNetwork = (network: string | number) => {
    if (!this.isNetwork(network)) throw new Error('Undefined network');

    return this.networks[network];
  };
}
