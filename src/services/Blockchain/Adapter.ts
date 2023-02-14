import axios from 'axios';
import dayjs from 'dayjs';
import { BigNumber } from 'bignumber.js';
import { ethers } from 'ethers';
import ethersMulticall from '@defihelper/ethers-multicall';
import * as Uniswap3Core from '@uniswap/sdk-core';
import * as Uniswap3SDK from '@uniswap/v3-sdk';
import vm from 'vm';
import { Blockchain } from '@models/types';
import { ContractAutomate } from '@models/Protocol/Entity';
import { PriceFeed } from '@models/Token/Entity';
import { BroadcastedTx, SignedTx, SignerInvokeTx } from '@waves/signer';

export class TemporaryOutOfService extends Error {
  constructor(m = 'wait a bit, usually it means that we updating our infrastructure') {
    super(m);
  }
}

export interface PriceNotResolvedError {
  network: number;
  address: string;
  message: string;
}

export function isPriceNotResolvedError(error: any): error is PriceNotResolvedError {
  return (
    typeof error === 'object' &&
    error instanceof Error &&
    Object.prototype.hasOwnProperty.call(error, 'network') &&
    Object.prototype.hasOwnProperty.call(error, 'address')
  );
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
    run: {
      methods: {
        runParams: () => Promise<EthereumAutomateRunParams | Error>;
        run: () => Promise<{ tx: ethers.ContractTransaction } | Error>;
      };
    };
  }>;
}

export interface WavesAutomateAdapter {
  (signer: any, contract: string): Promise<{
    deposit: () => Promise<BroadcastedTx<SignedTx<[SignerInvokeTx]>> | Error>;
    refund: () => Promise<BroadcastedTx<SignedTx<[SignerInvokeTx]>> | Error>;
    run: () => Promise<BroadcastedTx<SignedTx<[SignerInvokeTx]>> | Error>;
  }>;
}

interface ContractsResolver {
  [methodName: string]: (
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

  async loadAdapter<T = ProtocolAdapter>(protocol: string): Promise<T> {
    const adapterResponse = await axios.get(`${this.host}/${protocol}.js`).catch((e) => {
      if (e.response?.code === 503) throw new TemporaryOutOfService();
      throw new Error(`Undefined error in adapters: ${e.message}`);
    });
    const context = vm.createContext({
      Error,
      module: { exports: new Error('Adapter not evaluated') },
      console,
      mode: 'prod',
      bignumber: BigNumber,
      dayjs,
      axios,
      ethers,
      ethersMulticall,
      uniswap3: {
        core: Uniswap3Core,
        sdk: Uniswap3SDK,
      },
    });
    vm.runInContext(adapterResponse.data, context, { displayErrors: true });

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

  loadAliases() {
    return axios
      .get<Array<{ network: number; address: string; priceFeed: PriceFeed.PriceFeed }>>(
        `${this.host}/token-bridges`,
      )
      .then(({ data }) => data);
  }
}
