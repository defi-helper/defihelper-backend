import { Container, singleton } from '@services/Container';
import { isKey } from '@services/types';
import { fetchScriptInfo } from '@waves/node-api-js/cjs/api-node/addresses';
import { fetchInfo, fetchStatus } from '@waves/node-api-js/cjs/api-node/transactions';
import { Signer } from '@waves/signer';
import { ProviderSeed } from '@waves/provider-seed/cjs';

function nodeGatewayFactory(url: string) {
  return {
    addresses: {
      scriptInfo: fetchScriptInfo.bind(null, url),
    },
    transactions: {
      fetchInfo: fetchInfo.bind(null, url),
      fetchStatus: fetchStatus.bind(null, url),
    },
  };
}

export interface NetworkConfig {
  node: string;
  consumers: string[];
}

function networkFactory(
  config: {
    name: string;
    nodeGatewayURL: string;
    avgBlockTime: number;
    txExplorerURL: string;
    walletExplorerURL: string;
  } & NetworkConfig,
) {
  return {
    name: config.name,
    provider: singleton(() => config.node),
    providerHistorical: singleton(() => config.node),
    node: nodeGatewayFactory(config.nodeGatewayURL),
    avgBlockTime: config.avgBlockTime,
    txExplorerURL: new URL(config.txExplorerURL),
    walletExplorerURL: new URL(config.walletExplorerURL),
    consumers: () =>
      config.consumers.map((seed) => {
        const signer = new Signer({ NODE_URL: config.node });
        signer.setProvider(new ProviderSeed(seed));
        return signer;
      }),
    network: {
      node: config.node,
      consumers: config.consumers,
    },
  };
}

export interface Config {
  main: NetworkConfig;
  test: NetworkConfig;
}

export type Networks = keyof BlockchainContainer['networks'];

export class BlockchainContainer extends Container<Config> {
  readonly networks = {
    main: networkFactory({
      ...this.parent.main,
      name: 'Waves',
      nodeGatewayURL: 'https://nodes.wavesnodes.com',
      avgBlockTime: 60,
      txExplorerURL: 'https://wavesexplorer.com/tx',
      walletExplorerURL: 'https://wavesexplorer.com/address',
    }),
    test: networkFactory({
      ...this.parent.test,
      name: 'Waves Test',
      nodeGatewayURL: 'https://nodes-testnet.wavesnodes.com',
      avgBlockTime: 60,
      txExplorerURL: 'https://testnet.wavesexplorer.com/tx',
      walletExplorerURL: 'https://testnet.wavesexplorer.com/address',
    }),
  } as const;

  readonly isNetwork = (network: string | number): network is Networks => {
    return isKey(this.networks, network.toString());
  };

  readonly byNetwork = (network: string | number) => {
    if (!this.isNetwork(network)) throw new Error('Undefined network');

    return this.networks[network];
  };
}
