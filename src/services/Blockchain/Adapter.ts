import axios from 'axios';
import dayjs from 'dayjs';
import { BigNumber } from 'bignumber.js';
import { ethers } from 'ethers';
import ethersMulticall from '@defihelper/ethers-multicall';
import vm from 'vm';
import { Blockchain } from '@models/types';
import { ContractAutomate } from '@models/Protocol/Entity';

export class TemporaryOutOfService extends Error {
  constructor(m = 'wait a bit, usually it means that we updating our infrastructure') {
    super(m);
  }
}

export interface MetricMap {
  [k: string]: string;
}

export interface ContractTokenData {
  address: string;
  decimals: number;
  priceUSD: string;
  parts?: ContractTokenData[];
}

export interface MetricData extends Object {
  stakeToken?: ContractTokenData;
  rewardToken?: ContractTokenData;
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

interface ContractsResolver {
  default?: (
    provider: any,
    options: { cacheAuth?: string },
  ) => Promise<
    Array<{
      name: string;
      address: string;
      blockchain: Blockchain;
      network: string;
      layout: string;
      adapter: string;
      description: string;
      automate: ContractAutomate;
      link: string;
    }>
  >;
}

interface WavesAutomates {
  [k: string]: WavesAutomateAdapter | undefined;
}

interface WavesContractAdapters {
  [k: string]: ContractAdapter | undefined;
}

export type WavesProtocolAdapter = {
  automates: ({ contractsResolver?: ContractsResolver } & WavesAutomates) | undefined;
} & WavesContractAdapters;

interface EthereumAutomates {
  [k: string]: EthereumAutomateAdapter | undefined;
}

interface EthereumContractAdapters {
  [k: string]: ContractAdapter | undefined;
}

export type EthereumProtocolAdapter = {
  automates: ({ contractsResolver?: ContractsResolver } & EthereumAutomates) | undefined;
} & EthereumContractAdapters;

export type ProtocolAdapter = EthereumProtocolAdapter | WavesProtocolAdapter;

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

export interface WavesAutomateArtifact {
  contractName: string;
  base64: string;
  size: number;
  complexity: number;
}

function isWavesAutomateArtifact(data: any): data is WavesAutomateArtifact {
  return (
    typeof data === 'object' &&
    typeof data.contractName === 'string' &&
    typeof data.base64 === 'string' &&
    typeof data.size === 'number' &&
    typeof data.complexity === 'number'
  );
}

export class AdapterService {
  constructor(readonly host: string) {}

  async loadAdapter<T extends ProtocolAdapter = ProtocolAdapter>(protocol: string): Promise<T> {
    const adapterResponse = await axios.get(`${this.host}/${protocol}.js`).catch((e) => {
      if (e.response?.code === 503) throw new TemporaryOutOfService();
      throw new Error(`Undefined error in adapters: ${e.message}`);
    });
    const context = vm.createContext({
      Error,
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

  async loadEthereumAutomateArtifact(network: string, protocol: string, contract: string) {
    const artifactResponse = await axios
      .get(`${this.host}/automates/ethereum/${protocol}/${contract}/${network}`)
      .catch((e) => {
        if (e.response?.code === 503) throw new TemporaryOutOfService();
        throw new Error(`Undefined error in adapters: ${e.message}`);
      });
    const artifact = artifactResponse.data;
    if (!isEthereumAutomateArtifact(artifact)) throw new Error('Invalid artifact response');

    return artifact;
  }

  async loadWavesAutomateArtifact(protocol: string, contract: string) {
    const artifactResponse = await axios
      .get(`${this.host}/automates/waves/${protocol}/${contract}`)
      .catch((e) => {
        if (e.response?.code === 503) throw new TemporaryOutOfService();
        throw new Error(`Undefined error in adapters: ${e.message}`);
      });
    const artifact = artifactResponse.data;
    if (!isWavesAutomateArtifact(artifact)) throw new Error('Invalid artifact response');

    return artifact;
  }
}
