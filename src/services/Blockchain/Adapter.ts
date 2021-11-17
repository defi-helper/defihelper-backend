import axios from 'axios';
import dayjs from 'dayjs';
import { BigNumber } from 'bignumber.js';
import { ethers } from 'ethers';
import ethersMulticall from '@defihelper/ethers-multicall';
import vm from 'vm';

export interface MetricMap {
  [k: string]: string;
}

export interface MetricData extends Object {
  metrics?: MetricMap;
}

export interface TokensData {
  [t: string]: MetricMap;
}

export interface WalletData extends MetricData {
  tokens?: TokensData;
}

export interface ContractData extends MetricData {
  wallet?: (wallet: string) => Promise<WalletData>;
}

export interface ContractAdapterOptions {
  blockNumber?: number | string;
}

export interface ContractAdapter {
  (provider: any, contract: string, options: ContractAdapterOptions): Promise<ContractData>;
}

export interface EthereumAutomateRunParams {
  gasPrice: string;
  gasLimit: string;
  calldata: [string, ...any];
}

export interface EthereumAutomateAdapter {
  (signer: any, contract: string): Promise<{
    contract: string;
    migrate: () => Promise<ethers.Transaction | Error>;
    deposit: () => Promise<ethers.Transaction | Error>;
    refund: () => Promise<ethers.Transaction | Error>;
    runParams: () => Promise<EthereumAutomateRunParams | Error>;
    run: () => Promise<ethers.Transaction | Error>;
  }>;
}

export interface WavesAutomateAdapter {
  (signer: any, contract: string): Promise<{
    migrate: () => Promise<null | Error>;
    deposit: () => Promise<null | Error>;
    refund: () => Promise<null | Error>;
    run: () => Promise<null | Error>;
  }>;
}

export interface ProtocolAdapter {
  [k: string]:
    | ContractAdapter
    | {
        [k: string]: EthereumAutomateAdapter | WavesAutomateAdapter;
      };
}

export interface EthereumAutomateArtifact {
  contractName: string;
  address: string | undefined;
  abi: ethers.ContractInterface;
  bytecode: string;
  linkReferences: Object;
}

function isEthereumAutomateArtifact(data: any): data is EthereumAutomateArtifact {
  return (
    typeof data === 'object' &&
    Array.isArray(data.abi) &&
    typeof data.contractName === 'string' &&
    (typeof data.address === 'string' || data.address === undefined) &&
    typeof data.linkReferences === 'object'
  );
}

export class AdapterService {
  constructor(readonly host: string) {}

  async loadAdapter(protocol: string): Promise<ProtocolAdapter> {
    const adapterResponse = await axios.get(`${this.host}/${protocol}.js`);
    const context = vm.createContext({
      module: { exports: new Error('Adapter not evaluated') },
      console,
      bignumber: BigNumber,
      dayjs,
      axios,
      ethers,
      ethersMulticall,
    });
    vm.runInContext(adapterResponse.data, context);

    return context.module.exports;
  }

  async loadEthereumAutomateArtifact(
    network: string,
    protocol: string,
    contract: string,
  ): Promise<EthereumAutomateArtifact> {
    const artifactResponse = await axios.get(
      `${this.host}/automates/ethereum/${protocol}/${contract}/${network}`,
    );
    const artifact = artifactResponse.data;
    if (!isEthereumAutomateArtifact(artifact)) throw new Error('Invalid artifact response');

    return artifact;
  }
}
