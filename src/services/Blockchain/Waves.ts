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

export interface NativeTokenDetails {
  decimals: number;
  symbol: string;
  name: string;
}

function networkFactory(
  config: {
    id: string;
    name: string;
    testnet: boolean;
    nodeGatewayURL: string;
    avgBlockTime: number;
    explorerURL: URL;
    txExplorerURL: URL;
    walletExplorerURL: URL;
    icon: string;
    nativeTokenDetails: NativeTokenDetails;
  } & NetworkConfig,
) {
  return {
    id: config.id,
    name: config.name,
    testnet: config.testnet,
    icon: config.icon,
    provider: singleton(() => config.node),
    providerHistorical: singleton(() => config.node),
    node: nodeGatewayFactory(config.nodeGatewayURL),
    avgBlockTime: config.avgBlockTime,
    explorerURL: config.explorerURL,
    txExplorerURL: config.txExplorerURL,
    walletExplorerURL: config.walletExplorerURL,
    nativeTokenDetails: config.nativeTokenDetails,
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
      id: 'main',
      name: 'Waves',
      testnet: false,
      nodeGatewayURL: 'https://nodes.wavesnodes.com',
      avgBlockTime: 60,
      explorerURL: new URL('https://wavesexplorer.com'),
      txExplorerURL: new URL('https://wavesexplorer.com/tx'),
      walletExplorerURL: new URL('https://wavesexplorer.com/address'),
      icon: 'wavesRegular',
      nativeTokenDetails: {
        decimals: 8,
        symbol: 'WAVES',
        name: 'Waves',
      },
    }),
    test: networkFactory({
      ...this.parent.test,
      id: 'test',
      name: 'Waves Test',
      testnet: true,
      nodeGatewayURL: 'https://nodes-testnet.wavesnodes.com',
      avgBlockTime: 60,
      explorerURL: new URL('https://testnet.wavesexplorer.com'),
      txExplorerURL: new URL('https://testnet.wavesexplorer.com/tx'),
      walletExplorerURL: new URL('https://testnet.wavesexplorer.com/address'),
      icon: 'wavesRegular',
      nativeTokenDetails: {
        decimals: 8,
        symbol: 'WAVES',
        name: 'Waves',
      },
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
